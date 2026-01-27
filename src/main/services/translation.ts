import {
  getChapterContent,
  updateChapterStatus,
  updateChapterTranslation,
  getConfig,
  getProjectDefaultConfig
} from '../database'
import { getProject } from '../database/repositories/project.repository'
import { getMainWindow } from '../window'
import { executeChain, ChainExecutorOptions } from './chain-executor'
import { keyManager } from './key-manager'
import { getSettings } from '../database/repositories/settings.repository'
import type {
  TranslationProgressEvent,
  ChapterStatus,
  ChainExecutionStep,
  TranslationConfig
} from '../../shared/types'

// Active translation jobs
const activeJobs = new Map<string, TranslationJob>()

interface TranslationJob {
  projectId: string
  chapterIds: string[]
  configId: string
  currentIndex: number
  isPaused: boolean
  isCancelled: boolean
  concurrency: number
  completedCount: number
  errorCount: number
  totalCost: number
}

/**
 * Start translation for chapters
 */
export async function startTranslation(
  projectId: string,
  chapterIds: string[],
  configId?: string,
  concurrency?: number
): Promise<void> {
  // Check if already running
  if (activeJobs.has(projectId)) {
    throw new Error('Translation already in progress for this project')
  }

  // Get settings
  const settings = getSettings()
  const effectiveConcurrency = concurrency ?? settings.translationConcurrency

  // Get config (project default or specified)
  let config: TranslationConfig | null
  if (configId) {
    config = getConfig(configId)
  } else {
    config = getProjectDefaultConfig(projectId)
  }

  if (!config) {
    throw new Error('Translation config not found')
  }

  // Get API key
  const apiKey = await keyManager.getKey(config.providerId)
  if (!apiKey) {
    throw new Error(`No API key configured for ${config.providerId}`)
  }

  // Create job
  const job: TranslationJob = {
    projectId,
    chapterIds,
    configId: config.id,
    currentIndex: 0,
    isPaused: false,
    isCancelled: false,
    concurrency: effectiveConcurrency,
    completedCount: 0,
    errorCount: 0,
    totalCost: 0
  }

  activeJobs.set(projectId, job)

  console.log(
    `[Translation] Starting for project ${projectId}, ${chapterIds.length} chapters, concurrency ${effectiveConcurrency}`
  )

  // Start processing
  processJob(job, config, apiKey)
}

/**
 * Pause translation
 */
export function pauseTranslation(projectId: string): void {
  const job = activeJobs.get(projectId)
  if (job) {
    job.isPaused = true
    console.log(`[Translation] Paused for project ${projectId}`)
  }
}

/**
 * Resume translation
 */
export async function resumeTranslation(projectId: string): Promise<void> {
  const job = activeJobs.get(projectId)
  if (job && job.isPaused) {
    job.isPaused = false
    console.log(`[Translation] Resumed for project ${projectId}`)

    // Get config and API key to continue
    const config = getConfig(job.configId)
    if (config) {
      const apiKey = await keyManager.getKey(config.providerId)
      if (apiKey) {
        processJob(job, config, apiKey)
      }
    }
  }
}

/**
 * Cancel translation
 */
export function cancelTranslation(projectId: string): void {
  const job = activeJobs.get(projectId)
  if (job) {
    job.isCancelled = true
    activeJobs.delete(projectId)
    console.log(`[Translation] Cancelled for project ${projectId}`)
  }
}

/**
 * Get translation status
 */
export function getTranslationStatus(projectId: string): {
  isRunning: boolean
  isPaused: boolean
  progress: number
  completedCount: number
  errorCount: number
  totalCost: number
} | null {
  const job = activeJobs.get(projectId)
  if (!job) return null

  return {
    isRunning: !job.isPaused && !job.isCancelled,
    isPaused: job.isPaused,
    progress: (job.currentIndex / job.chapterIds.length) * 100,
    completedCount: job.completedCount,
    errorCount: job.errorCount,
    totalCost: job.totalCost
  }
}

/**
 * Process translation job
 */
async function processJob(
  job: TranslationJob,
  config: TranslationConfig,
  apiKey: string
): Promise<void> {
  const settings = getSettings()
  const project = getProject(job.projectId)
  const sourceLanguage = project?.sourceLanguage || 'auto'
  const targetLanguage = project?.targetLanguage || 'en'

  // Process in batches based on concurrency
  while (job.currentIndex < job.chapterIds.length) {
    if (job.isPaused || job.isCancelled) {
      break
    }

    // Get batch of chapters to process
    const batchIds = job.chapterIds.slice(job.currentIndex, job.currentIndex + job.concurrency)

    // Process batch in parallel
    await Promise.all(
      batchIds.map((chapterId) =>
        translateChapter(
          job,
          chapterId,
          config,
          apiKey,
          sourceLanguage,
          targetLanguage,
          settings.enableTranslationMemory,
          settings.enableGlossaryInjection
        )
      )
    )

    job.currentIndex += batchIds.length
  }

  // Clean up if complete
  if (job.currentIndex >= job.chapterIds.length && !job.isCancelled) {
    activeJobs.delete(job.projectId)
    console.log(
      `[Translation] Completed for project ${job.projectId}: ${job.completedCount} succeeded, ${job.errorCount} failed, $${job.totalCost.toFixed(4)} total cost`
    )
  }
}

/**
 * Translate a single chapter using the chain executor
 */
async function translateChapter(
  job: TranslationJob,
  chapterId: string,
  config: TranslationConfig,
  apiKey: string,
  sourceLanguage: string,
  targetLanguage: string,
  useMemory: boolean,
  useGlossary: boolean
): Promise<void> {
  const mainWindow = getMainWindow()

  // Update status to translating
  updateChapterStatus(chapterId, 'translating')
  sendProgressEvent(job.projectId, chapterId, 'translating', 0, 'Translating...', config.id)

  try {
    // Get chapter content
    const content = getChapterContent(chapterId)
    if (!content) {
      throw new Error('Chapter content not found')
    }

    // Execute translation with chain support
    const options: ChainExecutorOptions = {
      configId: config.id,
      sourceText: content.sourceText,
      sourceLanguage,
      targetLanguage,
      apiKey,
      projectId: job.projectId,
      useMemory,
      useGlossary,
      createSnapshot: false,
      window: mainWindow || undefined
    }

    const result = await executeChain(options)

    if (result.success && result.translatedText) {
      // Save translation
      updateChapterTranslation(chapterId, result.translatedText)
      updateChapterStatus(chapterId, 'translated')

      job.completedCount++
      job.totalCost += result.totalCostUsd

      sendProgressEvent(
        job.projectId,
        chapterId,
        'translated',
        100,
        `Complete (${result.source}, $${result.totalCostUsd.toFixed(4)})`,
        result.finalConfigId,
        result.executionPath
      )

      console.log(
        `[Translation] Chapter ${chapterId} completed via ${result.source}, cost: $${result.totalCostUsd.toFixed(4)}`
      )
    } else {
      // Translation failed
      const errorMessage = result.finalError || 'Translation failed'
      updateChapterStatus(chapterId, 'error', errorMessage)

      job.errorCount++

      sendProgressEvent(
        job.projectId,
        chapterId,
        'error',
        0,
        errorMessage,
        result.finalConfigId,
        result.executionPath
      )

      console.error(
        `[Translation] Chapter ${chapterId} failed: ${errorMessage} (${result.finalErrorType})`
      )
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    updateChapterStatus(chapterId, 'error', errorMessage)

    job.errorCount++

    sendProgressEvent(job.projectId, chapterId, 'error', 0, errorMessage, config.id)
    console.error(`[Translation] Chapter ${chapterId} error:`, errorMessage)
  }
}

/**
 * Send progress event to renderer
 */
function sendProgressEvent(
  projectId: string,
  chapterId: string,
  status: ChapterStatus,
  progress: number,
  message?: string,
  configId?: string,
  executionPath?: ChainExecutionStep[]
): void {
  const mainWindow = getMainWindow()
  if (mainWindow) {
    const event: TranslationProgressEvent = {
      projectId,
      chapterId,
      status,
      progress,
      message,
      configId,
      executionPath
    }
    mainWindow.webContents.send('translation:progress', event)
  }
}

// ============================================================================
// Legacy API Key Cache (for backward compatibility during migration)
// ============================================================================

const legacyApiKeyCache = new Map<string, string>()

/**
 * @deprecated Use keyManager.addKey() instead
 */
export function setApiKey(providerId: string, key: string): void {
  legacyApiKeyCache.set(providerId, key)
  // Also add to new key manager
  keyManager.addKey(providerId, key, 'Legacy key').catch(console.error)
}

/**
 * @deprecated Use keyManager.getKey() instead
 */
export function getApiKey(providerId: string): string | null {
  return legacyApiKeyCache.get(providerId) || null
}
