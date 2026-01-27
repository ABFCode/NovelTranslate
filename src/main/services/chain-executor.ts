/**
 * Chain Executor Service
 *
 * Orchestrates translation execution with fallback chain support.
 * Handles retries, error classification, and fallback to alternate configs.
 */

import { BrowserWindow } from 'electron'
import { providerRegistry } from '../providers'
import { classifyError, ClassificationResult } from './error-classifier'
import { executeWithRetry, DEFAULT_RETRY_CONFIG } from './retry-strategy'
import {
  getConfig,
  getFallbacksForConfig,
  createConfigSnapshot
} from '../database/repositories/config.repository'
import {
  getMemoryBySourceText,
  incrementMemoryUsage,
  cacheTranslation
} from '../database/repositories/memory.repository'
import { getOverride } from '../database/repositories/memory.repository'
import {
  listGlossaryTerms,
  incrementTermUsage
} from '../database/repositories/glossary.repository'
import { recordSpending } from '../database/repositories/budget.repository'
import type {
  ChainExecutionResult,
  ChainExecutionStep,
  TranslationConfig,
  ConfigFallback,
  ErrorType,
  RetryConfig,
  GlossaryTerm
} from '../../shared/types'

export interface ChainExecutorOptions {
  /** The starting config ID */
  configId: string
  /** Source text to translate */
  sourceText: string
  /** Source language */
  sourceLanguage: string
  /** Target language */
  targetLanguage: string
  /** API key to use */
  apiKey: string
  /** Project ID (for glossary, memory, budget) */
  projectId?: string
  /** Optional retry configuration override */
  retryConfig?: RetryConfig
  /** Whether to use translation memory */
  useMemory?: boolean
  /** Whether to inject glossary terms */
  useGlossary?: boolean
  /** Whether to create config snapshot before testing */
  createSnapshot?: boolean
  /** Snapshot reason */
  snapshotReason?: 'test' | 'translation'
  /** Browser window for events */
  window?: BrowserWindow
}

/**
 * Maximum chain depth to prevent infinite loops
 */
const MAX_CHAIN_DEPTH = 10

/**
 * Execute a translation with fallback chain support
 */
export async function executeChain(options: ChainExecutorOptions): Promise<ChainExecutionResult> {
  const {
    configId,
    sourceText,
    sourceLanguage,
    targetLanguage,
    apiKey,
    projectId,
    useMemory = true,
    useGlossary = true,
    createSnapshot = false,
    snapshotReason = 'translation',
    window
  } = options

  const executionPath: ChainExecutionStep[] = []
  const attemptedConfigs = new Set<string>()
  let totalCostUsd = 0
  let glossaryTermsUsed = 0

  // Check for override first
  if (projectId) {
    const override = getOverride(sourceText, projectId)
    if (override) {
      return {
        success: true,
        translatedText: override.overrideTranslation,
        tokensUsed: { input: 0, output: 0, total: 0 },
        totalCostUsd: 0,
        executionPath: [],
        source: 'override',
        glossaryTermsUsed: 0
      }
    }
  }

  // Check translation memory
  if (useMemory) {
    const cached = getMemoryBySourceText(sourceText, configId, projectId)
    if (cached && cached.confidence >= 0.8) {
      incrementMemoryUsage(cached.id)
      return {
        success: true,
        translatedText: cached.targetText,
        tokensUsed: { input: 0, output: 0, total: 0 },
        totalCostUsd: 0,
        executionPath: [],
        source: 'memory',
        glossaryTermsUsed: 0
      }
    }
  }

  // Get glossary terms if enabled
  let glossaryTerms: GlossaryTerm[] = []
  if (useGlossary && projectId) {
    glossaryTerms = listGlossaryTerms(projectId)
  }

  // Create snapshot if requested
  if (createSnapshot) {
    try {
      createConfigSnapshot(configId, snapshotReason)
    } catch {
      // Ignore snapshot errors
    }
  }

  // Execute with fallbacks
  const result = await executeWithFallbacks({
    currentConfigId: configId,
    sourceText,
    sourceLanguage,
    targetLanguage,
    apiKey,
    projectId,
    glossaryTerms,
    executionPath,
    attemptedConfigs,
    retryConfig: options.retryConfig,
    window
  })

  // Update total cost
  for (const step of executionPath) {
    totalCostUsd += step.costUsd
  }

  // Update glossary usage
  if (result.success && glossaryTerms.length > 0) {
    // Simple heuristic: count terms that appear in the translated text
    const usedTermIds: string[] = []
    for (const term of glossaryTerms) {
      if (
        result.translatedText?.includes(term.targetTerm) ||
        sourceText.includes(term.sourceTerm)
      ) {
        usedTermIds.push(term.id)
      }
    }
    if (usedTermIds.length > 0) {
      incrementTermUsage(usedTermIds)
      glossaryTermsUsed = usedTermIds.length
    }
  }

  // Cache successful translation
  if (result.success && result.translatedText && useMemory) {
    const finalConfig = getConfig(result.finalConfigId!)
    if (finalConfig) {
      cacheTranslation(
        sourceText,
        result.translatedText,
        finalConfig.providerId,
        finalConfig.modelId,
        result.finalConfigId,
        projectId
      )
    }
  }

  // Record spending if project ID provided
  if (projectId && totalCostUsd > 0) {
    recordSpending(projectId, totalCostUsd)
  }

  return {
    ...result,
    totalCostUsd,
    executionPath,
    source: 'live',
    glossaryTermsUsed
  }
}

// ============================================================================
// Internal Execution Logic
// ============================================================================

interface ExecuteWithFallbacksOptions {
  currentConfigId: string
  sourceText: string
  sourceLanguage: string
  targetLanguage: string
  apiKey: string
  projectId?: string
  glossaryTerms: GlossaryTerm[]
  executionPath: ChainExecutionStep[]
  attemptedConfigs: Set<string>
  retryConfig?: RetryConfig
  triggeringErrorType?: ErrorType
  window?: BrowserWindow
}

async function executeWithFallbacks(
  options: ExecuteWithFallbacksOptions
): Promise<Omit<ChainExecutionResult, 'totalCostUsd' | 'executionPath' | 'source' | 'glossaryTermsUsed'>> {
  const {
    currentConfigId,
    sourceText,
    sourceLanguage,
    targetLanguage,
    apiKey,
    glossaryTerms,
    executionPath,
    attemptedConfigs,
    retryConfig,
    window
  } = options

  // Prevent cycles and excessive depth
  if (attemptedConfigs.has(currentConfigId) || executionPath.length >= MAX_CHAIN_DEPTH) {
    return {
      success: false,
      tokensUsed: { input: 0, output: 0, total: 0 },
      finalError: 'Chain depth exceeded or cycle detected',
      finalErrorType: 'unknown'
    }
  }

  attemptedConfigs.add(currentConfigId)

  // Get the config
  const config = getConfig(currentConfigId)
  if (!config) {
    return {
      success: false,
      tokensUsed: { input: 0, output: 0, total: 0 },
      finalError: `Config not found: ${currentConfigId}`,
      finalErrorType: 'unknown'
    }
  }

  // Get the provider
  const provider = providerRegistry.get(config.providerId)
  if (!provider) {
    return {
      success: false,
      tokensUsed: { input: 0, output: 0, total: 0 },
      finalError: `Provider not found: ${config.providerId}`,
      finalErrorType: 'unknown'
    }
  }

  // Build the prompt with glossary injection
  const systemPrompt = buildSystemPromptWithGlossary(config.systemPrompt, glossaryTerms)
  const userPrompt = buildUserPrompt(config.userPromptTemplate, sourceText, sourceLanguage, targetLanguage)

  // Execute with retry
  const startTime = Date.now()
  const effectiveRetryConfig = retryConfig || {
    ...DEFAULT_RETRY_CONFIG,
    id: 'temp',
    createdAt: new Date().toISOString()
  }

  let lastError: unknown
  let lastClassification: ClassificationResult | undefined
  let totalRetries = 0

  const { result, error, attempts, errorType } = await executeWithRetry(
    async () => {
      return provider.translate({
        modelId: config.modelId,
        systemPrompt,
        userPrompt,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        apiKey
      })
    },
    config.providerId,
    effectiveRetryConfig,
    (attempt, err, delayMs) => {
      totalRetries++
      console.log(
        `[ChainExecutor] Retry ${attempt} for ${config.name}, waiting ${delayMs}ms`
      )
    }
  )

  const durationMs = Date.now() - startTime

  // Handle provider result
  if (result) {
    // Check for error in result (provider-specific error handling)
    if (result.error || result.finishReason === 'error') {
      lastError = result.error
      lastClassification = classifyError(result.error, config.providerId)
    } else {
      // Success!
      const step: ChainExecutionStep = {
        configId: currentConfigId,
        configName: config.name,
        providerId: config.providerId,
        modelId: config.modelId,
        attemptNumber: attempts,
        durationMs,
        costUsd: calculateCost(result.tokensUsed.input, result.tokensUsed.output, config),
        retryCount: totalRetries
      }
      executionPath.push(step)

      return {
        success: true,
        translatedText: result.translatedText,
        tokensUsed: result.tokensUsed,
        finalConfigId: currentConfigId
      }
    }
  } else if (error) {
    lastError = error
    lastClassification = classifyError(error, config.providerId)
  }

  // Record the failed step
  const failedStep: ChainExecutionStep = {
    configId: currentConfigId,
    configName: config.name,
    providerId: config.providerId,
    modelId: config.modelId,
    attemptNumber: attempts,
    durationMs,
    costUsd: 0,
    error: lastClassification?.details || String(lastError),
    errorType: lastClassification?.errorType || errorType || 'unknown',
    retryCount: totalRetries
  }
  executionPath.push(failedStep)

  // Emit fallback event
  const actualErrorType = lastClassification?.errorType || errorType || 'unknown'
  
  // Try to find a matching fallback
  const fallbacks = getFallbacksForConfig(currentConfigId)
  const matchingFallback = findMatchingFallback(fallbacks, actualErrorType)

  if (matchingFallback) {
    // Emit fallback event
    window?.webContents.send('translation:chainFallback', {
      fromConfigId: currentConfigId,
      toConfigId: matchingFallback.fallbackConfigId,
      errorType: actualErrorType,
      error: String(lastError)
    })

    // Recurse with the fallback config
    return executeWithFallbacks({
      ...options,
      currentConfigId: matchingFallback.fallbackConfigId,
      triggeringErrorType: actualErrorType
    })
  }

  // No fallback available - final failure
  return {
    success: false,
    tokensUsed: { input: 0, output: 0, total: 0 },
    finalError: String(lastError),
    finalErrorType: actualErrorType
  }
}

/**
 * Find the first matching fallback for an error type
 */
function findMatchingFallback(
  fallbacks: ConfigFallback[],
  errorType: ErrorType
): ConfigFallback | undefined {
  // Sort by priority (lower = higher priority)
  const sorted = [...fallbacks].sort((a, b) => a.priority - b.priority)

  // Find first match
  return sorted.find((fb) => fb.conditionType === 'any' || fb.conditionType === errorType)
}

/**
 * Build user prompt from template
 */
function buildUserPrompt(
  template: string,
  text: string,
  sourceLanguage: string,
  targetLanguage: string
): string {
  return template
    .replace(/\{\{text\}\}/g, text)
    .replace(/\{\{sourceLanguage\}\}/g, sourceLanguage)
    .replace(/\{\{targetLanguage\}\}/g, targetLanguage)
}

/**
 * Inject glossary terms into system prompt
 */
function buildSystemPromptWithGlossary(basePrompt: string, terms: GlossaryTerm[]): string {
  if (terms.length === 0) return basePrompt

  const glossarySection = `

## Translation Glossary
Use these exact translations for the following terms:

${terms
  .map((t) => {
    let entry = `- "${t.sourceTerm}" → "${t.targetTerm}"`
    if (t.gender) entry += ` (${t.gender})`
    if (t.pronouns) entry += ` [${t.pronouns}]`
    if (t.aliases.length > 0) entry += ` Also: ${t.aliases.join(', ')}`
    if (t.context) entry += ` | Context: ${t.context}`
    return entry
  })
  .join('\n')}

IMPORTANT: Always use these translations consistently. Pay attention to gender and pronouns.`

  return basePrompt + glossarySection
}

/**
 * Calculate cost based on token usage
 * This is a simplified calculation - actual costs depend on model pricing
 */
function calculateCost(
  inputTokens: number,
  outputTokens: number,
  config: TranslationConfig
): number {
  // Default pricing (very rough estimates - should be fetched from provider)
  const pricing: Record<string, { input: number; output: number }> = {
    'gpt-4o': { input: 5, output: 15 },
    'gpt-4o-mini': { input: 0.15, output: 0.6 },
    'gpt-4-turbo': { input: 10, output: 30 },
    'claude-3-5-sonnet-20241022': { input: 3, output: 15 },
    'claude-3-opus-20240229': { input: 15, output: 75 },
    'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
    'gemini-1.5-pro': { input: 3.5, output: 10.5 },
    'gemini-1.5-flash': { input: 0.075, output: 0.3 }
  }

  const modelPricing = pricing[config.modelId] || { input: 1, output: 3 }

  const inputCost = (inputTokens / 1_000_000) * modelPricing.input
  const outputCost = (outputTokens / 1_000_000) * modelPricing.output

  return inputCost + outputCost
}
