import { providerRegistry } from '../providers'
import {
  getChapterContent,
  updateChapterStatus,
  updateChapterTranslation,
  getConfig,
} from '../database'
import { getMainWindow } from '../window'
import type { TranslationProgressEvent, ChapterStatus } from '../../shared/types'

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
}

// In-memory API key cache (in production, use safeStorage)
const apiKeyCache = new Map<string, string>()

export function setApiKey(providerId: string, key: string): void {
  apiKeyCache.set(providerId, key)
}

export function getApiKey(providerId: string): string | null {
  return apiKeyCache.get(providerId) || null
}

/**
 * Start translation for chapters
 */
export async function startTranslation(
  projectId: string,
  chapterIds: string[],
  configId: string,
  concurrency = 3
): Promise<void> {
  // Check if already running
  if (activeJobs.has(projectId)) {
    throw new Error('Translation already in progress for this project')
  }

  // Get config
  const config = getConfig(configId)
  if (!config) {
    throw new Error('Translation config not found')
  }

  // Get API key
  const apiKey = getApiKey(config.providerId)
  if (!apiKey) {
    throw new Error(`No API key configured for ${config.providerId}`)
  }

  // Create job
  const job: TranslationJob = {
    projectId,
    chapterIds,
    configId,
    currentIndex: 0,
    isPaused: false,
    isCancelled: false,
    concurrency,
  }

  activeJobs.set(projectId, job)

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
export function resumeTranslation(projectId: string): void {
  const job = activeJobs.get(projectId)
  if (job && job.isPaused) {
    job.isPaused = false
    console.log(`[Translation] Resumed for project ${projectId}`)

    // Get config and API key to continue
    const config = getConfig(job.configId)
    if (config) {
      const apiKey = getApiKey(config.providerId)
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
 * Process translation job
 */
async function processJob(
  job: TranslationJob,
  config: any,
  apiKey: string
): Promise<void> {
  const provider = providerRegistry.get(config.providerId)
  if (!provider) {
    throw new Error(`Provider not found: ${config.providerId}`)
  }

  // Process in batches based on concurrency
  while (job.currentIndex < job.chapterIds.length) {
    if (job.isPaused || job.isCancelled) {
      break
    }

    // Get batch of chapters to process
    const batchIds = job.chapterIds.slice(
      job.currentIndex,
      job.currentIndex + job.concurrency
    )

    // Process batch in parallel
    await Promise.all(
      batchIds.map((chapterId) =>
        translateChapter(job, chapterId, config, provider, apiKey)
      )
    )

    job.currentIndex += batchIds.length
  }

  // Clean up if complete
  if (job.currentIndex >= job.chapterIds.length && !job.isCancelled) {
    activeJobs.delete(job.projectId)
    console.log(`[Translation] Completed for project ${job.projectId}`)
  }
}

/**
 * Translate a single chapter
 */
async function translateChapter(
  job: TranslationJob,
  chapterId: string,
  config: any,
  provider: any,
  apiKey: string
): Promise<void> {
  // Update status to translating
  updateChapterStatus(chapterId, 'translating')
  sendProgressEvent(job.projectId, chapterId, 'translating', 0, 'Translating...')

  try {
    // Get chapter content
    const content = getChapterContent(chapterId)
    if (!content) {
      throw new Error('Chapter content not found')
    }

    // Build prompt
    const userPrompt = config.userPromptTemplate
      .replace('{{text}}', content.sourceText)
      .replace('{{sourceLanguage}}', 'Chinese')
      .replace('{{targetLanguage}}', 'English')

    // Call provider
    const result = await provider.translate({
      modelId: config.modelId,
      systemPrompt: config.systemPrompt,
      userPrompt,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      apiKey,
    })

    if (result.finishReason === 'error') {
      throw new Error(result.error || 'Translation failed')
    }

    // Save translation
    updateChapterTranslation(chapterId, result.translatedText)
    updateChapterStatus(chapterId, 'translated')
    sendProgressEvent(job.projectId, chapterId, 'translated', 100, 'Complete')

    console.log(`[Translation] Chapter ${chapterId} completed`)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    updateChapterStatus(chapterId, 'error', errorMessage)
    sendProgressEvent(job.projectId, chapterId, 'error', 0, errorMessage)
    console.error(`[Translation] Chapter ${chapterId} failed:`, errorMessage)
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
  message?: string
): void {
  const mainWindow = getMainWindow()
  if (mainWindow) {
    const event: TranslationProgressEvent = {
      projectId,
      chapterId,
      status,
      progress,
      message,
    }
    mainWindow.webContents.send('translation:progress', event)
  }
}
