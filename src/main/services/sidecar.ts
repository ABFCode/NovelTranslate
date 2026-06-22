import { type ChildProcess, spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import http from 'node:http'
import { join } from 'node:path'
import { app } from 'electron'
import { logger } from './logger'

// Sidecar state
let sidecarProcess: ChildProcess | null = null
let sidecarPort: number | null = null
let isConnected = false

// Shared secret sent with every request and verified by the Go sidecar.
// Regenerated each time the sidecar is (re)started.
let sidecarToken: string | null = null

// Get path to sidecar binary
function getSidecarPath(): string {
  const isDev = !app.isPackaged

  if (isDev) {
    // In development, use the binary in go-sidecar folder
    return join(app.getAppPath(), 'go-sidecar', 'sidecar')
  } else {
    // In production, use the binary bundled with the app
    return join(process.resourcesPath, 'sidecar')
  }
}

/**
 * Make an HTTP request to the sidecar (non-streaming)
 */
function request<T>(path: string, body?: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    if (!sidecarPort) {
      reject(new Error('Sidecar not running'))
      return
    }

    const postData = body ? JSON.stringify(body) : ''
    const headers: Record<string, string | number> = {
      ...(sidecarToken ? { 'X-Sidecar-Token': sidecarToken } : {}),
    }
    if (body) {
      headers['Content-Type'] = 'application/json'
      headers['Content-Length'] = Buffer.byteLength(postData)
    }
    const options = {
      hostname: '127.0.0.1',
      port: sidecarPort,
      path,
      method: body ? 'POST' : 'GET',
      headers,
    }

    const req = http.request(options, (res) => {
      let data = ''

      res.on('data', (chunk) => {
        data += chunk
      })

      res.on('end', () => {
        try {
          const parsed = JSON.parse(data)
          resolve(parsed as T)
        } catch (_error) {
          reject(new Error(`Invalid JSON response: ${data}`))
        }
      })
    })

    req.on('error', (error) => {
      reject(error)
    })

    if (body) {
      req.write(postData)
    }
    req.end()
  })
}

/**
 * Make an SSE streaming request to the sidecar
 */
function streamRequest<T>(path: string, body: unknown, onEvent: (event: T) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!sidecarPort) {
      reject(new Error('Sidecar not running'))
      return
    }

    const postData = JSON.stringify(body)
    const options = {
      hostname: '127.0.0.1',
      port: sidecarPort,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        Accept: 'text/event-stream',
        ...(sidecarToken ? { 'X-Sidecar-Token': sidecarToken } : {}),
      },
    }

    const req = http.request(options, (res) => {
      let buffer = ''

      res.on('data', (chunk: Buffer) => {
        buffer += chunk.toString()

        // Process complete SSE events (data: ...\n\n)
        const events = buffer.split('\n\n')
        buffer = events.pop() || '' // Keep incomplete event in buffer

        for (const eventStr of events) {
          if (eventStr.startsWith('data: ')) {
            try {
              const data = JSON.parse(eventStr.slice(6))
              onEvent(data as T)
            } catch (_e) {
              logger.error(`[Sidecar] Failed to parse SSE event: ${eventStr}`)
            }
          }
        }
      })

      res.on('end', () => {
        // Process any remaining data in buffer
        if (buffer.startsWith('data: ')) {
          try {
            const data = JSON.parse(buffer.slice(6))
            onEvent(data as T)
          } catch (_e) {
            // Ignore incomplete final event
          }
        }
        resolve()
      })

      res.on('error', reject)
    })

    req.on('error', reject)
    req.write(postData)
    req.end()
  })
}

/**
 * Start the Go sidecar process
 */
export async function startSidecar(): Promise<void> {
  if (sidecarProcess) {
    logger.info('[Sidecar] Already running')
    return
  }

  return new Promise((resolve, reject) => {
    const sidecarPath = getSidecarPath()
    logger.info(`[Sidecar] Starting: ${sidecarPath}`)

    // Fresh shared secret for this sidecar instance, passed via env so it is
    // not visible in the process argument list.
    sidecarToken = randomBytes(32).toString('hex')

    sidecarProcess = spawn(sidecarPath, ['--port', '0'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, SIDECAR_TOKEN: sidecarToken },
    })

    let portReceived = false

    sidecarProcess.stdout?.on('data', (data: Buffer) => {
      const output = data.toString()
      logger.debug(`[Sidecar stdout] ${output}`)

      // Parse port from output
      const portMatch = output.match(/PORT:(\d+)/)
      if (portMatch && !portReceived) {
        portReceived = true
        sidecarPort = parseInt(portMatch[1], 10)
        logger.info(`[Sidecar] Listening on port ${sidecarPort}`)

        // Test connection with health check
        healthCheck()
          .then((healthy) => {
            if (healthy) {
              isConnected = true
              logger.info('[Sidecar] Connected and healthy')
              resolve()
            } else {
              reject(new Error('Sidecar health check failed'))
            }
          })
          .catch(reject)
      }
    })

    sidecarProcess.stderr?.on('data', (data: Buffer) => {
      logger.error(`[Sidecar stderr] ${data.toString()}`)
    })

    sidecarProcess.on('error', (err) => {
      logger.error('[Sidecar] Process error:', err)
      sidecarProcess = null
      isConnected = false
      if (!portReceived) {
        reject(err)
      }
    })

    sidecarProcess.on('exit', (code) => {
      logger.info(`[Sidecar] Process exited with code ${code}`)
      sidecarProcess = null
      sidecarPort = null
      sidecarToken = null
      isConnected = false
    })

    // Timeout if port not received
    setTimeout(() => {
      if (!portReceived) {
        reject(new Error('Sidecar did not report port in time'))
      }
    }, 10000)
  })
}

/**
 * Stop the sidecar process
 */
export function stopSidecar(): void {
  if (sidecarProcess) {
    logger.info('[Sidecar] Stopping...')
    sidecarProcess.kill('SIGTERM')
    sidecarProcess = null
    sidecarPort = null
    sidecarToken = null
    isConnected = false
  }
}

/**
 * Check if sidecar is connected
 */
export function isSidecarConnected(): boolean {
  return isConnected
}

/**
 * Health check
 */
export async function healthCheck(): Promise<boolean> {
  if (!sidecarPort) {
    return false
  }

  try {
    const response = await request<{ healthy: boolean; version: string }>('/health')
    logger.debug(`[Sidecar] Health check: v${response.version}`)
    return response.healthy
  } catch {
    return false
  }
}

// SSE event types from Go sidecar
interface SSEProgressEvent {
  type: 'progress' | 'complete' | 'error'
  current?: number
  total?: number
  message?: string
  error?: string
  metadata?: EpubMetadata
  chapters?: Array<{
    spine_index: number
    title: string
    content: string
    word_count: number
  }>
  cover_image?: number[] // Go sends []byte as number array in JSON
  cover_content_type?: string
}

/**
 * Parse an EPUB file with streaming progress
 */
export async function parseEpub(
  filePath: string,
  onProgress?: (progress: EpubProgress) => void
): Promise<EpubResult> {
  if (!sidecarPort) {
    throw new Error('Sidecar not connected')
  }

  let result: EpubResult | null = null
  let error: string | null = null

  await streamRequest<SSEProgressEvent>('/epub/parse', { file_path: filePath }, (event) => {
    switch (event.type) {
      case 'progress':
        if (onProgress) {
          onProgress({
            current: event.current || 0,
            total: event.total || 100,
            message: event.message || '',
          })
        }
        break

      case 'complete':
        if (onProgress) {
          onProgress({
            current: 100,
            total: 100,
            message: 'Complete',
          })
        }
        result = {
          metadata: event.metadata!,
          chapters: (event.chapters || []).map((ch) => ({
            spineIndex: ch.spine_index,
            title: ch.title,
            content: ch.content,
            wordCount: ch.word_count,
          })),
          coverImage: event.cover_image ? Buffer.from(event.cover_image) : undefined,
          coverContentType: event.cover_content_type,
        }
        break

      case 'error':
        error = event.error || 'Unknown error'
        break
    }
  })

  if (error) {
    throw new Error(error)
  }

  if (!result) {
    throw new Error('No result received from sidecar')
  }

  return result
}

/**
 * Export chapters to an EPUB file
 */
export async function exportEpub(
  outputPath: string,
  metadata: EpubMetadata,
  chapters: ExportChapter[],
  coverImage?: Buffer,
  coverContentType?: string
): Promise<ExportResult> {
  if (!sidecarPort) {
    throw new Error('Sidecar not connected')
  }

  const response = await request<{
    success: boolean
    file_path?: string
    error?: string
  }>('/epub/export', {
    output_path: outputPath,
    metadata,
    chapters,
    cover_image: coverImage ? Array.from(coverImage) : undefined,
    cover_content_type: coverContentType,
  })

  if (!response.success) {
    throw new Error(response.error || 'Export failed')
  }

  return {
    success: true,
    filePath: response.file_path || outputPath,
  }
}

// Types
export interface EpubProgress {
  current: number
  total: number
  message: string
}

export interface EpubMetadata {
  title: string
  author: string
  language: string
  description: string
  publisher: string
  subjects: string[]
}

export interface EpubChapter {
  spineIndex: number
  title: string
  content: string
  wordCount: number
}

export interface EpubResult {
  metadata: EpubMetadata
  chapters: EpubChapter[]
  coverImage?: Buffer
  coverContentType?: string
}

export interface ExportChapter {
  title: string
  content: string
}

export interface ExportResult {
  success: boolean
  filePath: string
}
