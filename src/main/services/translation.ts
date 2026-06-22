import {
  getChapterContent,
  updateChapterStatus,
  updateChapterTranslation,
  getConfig,
  getProjectDefaultConfig,
  archiveTranslation
} from '../database'
import { getProject } from '../database/repositories/project.repository'
import { getMainWindow } from '../window'
import { executeChain, ChainExecutorOptions } from './chain-executor'
import { keyManager } from './key-manager'
import { getSettings } from '../database/repositories/settings.repository'
import { logger } from './logger'
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
  const apiKey = await keyManager.getKey(config.providerConfigId)
  if (!apiKey) {
    throw new Error(`No API key configured for provider config ${config.providerConfigId}`)
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

  logger.info(
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
    logger.info(`[Translation] Paused for project ${projectId}`)
  }
}

/**
 * Resume translation
 */
export async function resumeTranslation(projectId: string): Promise<void> {
  const job = activeJobs.get(projectId)
  if (job && job.isPaused) {
    job.isPaused = false
    logger.info(`[Translation] Resumed for project ${projectId}`)

    // Get config and API key to continue
    const config = getConfig(job.configId)
    if (config) {
      const apiKey = await keyManager.getKey(config.providerConfigId)
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
    logger.info(`[Translation] Cancelled for project ${projectId}`)
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
    logger.info(
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
      // Archive existing translation if present
      if (content.translatedText) {
        archiveTranslation(
          chapterId,
          content.translatedText,
          config.id,
          config.name,
          config.providerConfigId,
          config.modelId
        )
      }

      // Save new translation
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

      logger.info(
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

      logger.error(
        `[Translation] Chapter ${chapterId} failed: ${errorMessage} (${result.finalErrorType})`
      )
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    updateChapterStatus(chapterId, 'error', errorMessage)

    job.errorCount++

    sendProgressEvent(job.projectId, chapterId, 'error', 0, errorMessage, config.id)
    logger.error(`[Translation] Chapter ${chapterId} error: ${errorMessage}`)
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
// Preview Translation
// ============================================================================

export interface PreviewResult {
  success: boolean
  translatedText?: string
  originalText: string
  costUsd: number
  tokensUsed: { input: number; output: number }
  providerConfigId: string
  modelId: string
  error?: string
}

/**
 * Preview translation for a text sample
 * Takes first ~1000 characters to give a quick preview
 */
export async function previewTranslation(
  text: string,
  configId: string,
  sourceLanguage: string,
  targetLanguage: string
): Promise<PreviewResult> {
  // Limit to first ~1000 characters, but try to end at a sentence
  const maxLength = 1000
  let previewText = text.substring(0, maxLength)

  // Try to find a good break point (end of sentence or paragraph)
  const lastPeriod = previewText.lastIndexOf('.')
  const lastNewline = previewText.lastIndexOf('\n')
  const breakPoint = Math.max(lastPeriod, lastNewline)

  if (breakPoint > maxLength * 0.5) {
    previewText = text.substring(0, breakPoint + 1)
  }

  const config = getConfig(configId)
  if (!config) {
    return {
      success: false,
      originalText: previewText,
      costUsd: 0,
      tokensUsed: { input: 0, output: 0 },
      providerConfigId: '',
      modelId: '',
      error: 'Config not found'
    }
  }

  const apiKey = await keyManager.getKey(config.providerConfigId)
  if (!apiKey) {
    return {
      success: false,
      originalText: previewText,
      costUsd: 0,
      tokensUsed: { input: 0, output: 0 },
      providerConfigId: config.providerConfigId,
      modelId: config.modelId,
      error: `No API key for provider config ${config.providerConfigId}`
    }
  }

  try {
    const options: ChainExecutorOptions = {
      configId,
      sourceText: previewText,
      sourceLanguage,
      targetLanguage,
      apiKey,
      useMemory: false,
      useGlossary: false,
      createSnapshot: false
    }

    const result = await executeChain(options)

    return {
      success: result.success,
      translatedText: result.translatedText,
      originalText: previewText,
      costUsd: result.totalCostUsd,
      tokensUsed: {
        input: result.tokensUsed.input,
        output: result.tokensUsed.output
      },
      providerConfigId: config.providerConfigId,
      modelId: config.modelId,
      error: result.finalError
    }
  } catch (error) {
    return {
      success: false,
      originalText: previewText,
      costUsd: 0,
      tokensUsed: { input: 0, output: 0 },
      providerConfigId: config.providerConfigId,
      modelId: config.modelId,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

// ============================================================================
// Legacy API Key Cache (for backward compatibility during migration)
// ============================================================================

const legacyApiKeyCache = new Map<string, string>()

/**
 * @deprecated Use keyManager.addKey() instead
 */
export function setApiKey(providerConfigId: string, key: string): void {
  legacyApiKeyCache.set(providerConfigId, key)
  // Also add to new key manager
  keyManager.addKey(providerConfigId, key, 'Legacy key').catch((err) => logger.error('[Translation] Failed to add legacy key', err instanceof Error ? err : new Error(String(err))))
}

/**
 * @deprecated Use keyManager.getKey() instead
 */
export function getApiKey(providerConfigId: string): string | null {
  return legacyApiKeyCache.get(providerConfigId) || null
}
