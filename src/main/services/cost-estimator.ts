/**
 * Cost Estimator Service
 *
 * Estimates translation costs before execution and tracks spending.
 */

import type { CostEstimate, TranslationConfig } from '../../shared/types'
import { checkBudget as checkProjectBudget } from '../database/repositories/budget.repository'
import { getConfig, getFallbacksForConfig } from '../database/repositories/config.repository'

/**
 * Model pricing per million tokens (USD)
 */
export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  // OpenAI
  'gpt-5.5': { input: 5, output: 30 },
  'gpt-5.4': { input: 2.5, output: 15 },
  'gpt-5.4-mini': { input: 0.75, output: 4.5 },
  'gpt-5.4-nano': { input: 0.2, output: 1.25 },

  // Anthropic
  'claude-opus-4-8': { input: 5, output: 25 },
  'claude-sonnet-4-6': { input: 3, output: 15 },
  'claude-haiku-4-5': { input: 1, output: 5 },

  // Google Gemini
  'gemini-3.5-flash': { input: 1.5, output: 9 },
  'gemini-3.1-flash-lite': { input: 0.25, output: 1.5 },
  'gemini-2.5-pro': { input: 1.25, output: 10 },
  'gemini-2.5-flash': { input: 0.3, output: 2.5 },
  'gemini-2.5-flash-lite': { input: 0.1, output: 0.4 },

  // xAI (Grok)
  'grok-4.20': { input: 2, output: 6 },
  'grok-4.1-fast': { input: 0.2, output: 0.5 },

  // DeepSeek
  'deepseek-v4-flash': { input: 0.14, output: 0.28 },
  'deepseek-v4-pro': { input: 0.44, output: 0.87 },
}

/**
 * Estimate tokens from text
 * Rough approximation: ~4 characters per token for English, ~2 for CJK
 */
export function estimateTokens(text: string): number {
  // Detect if text is predominantly CJK
  const cjkPattern = /[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/g
  const cjkMatches = text.match(cjkPattern) || []
  const cjkRatio = cjkMatches.length / text.length

  // Mixed calculation based on CJK ratio
  const englishChars = text.length * (1 - cjkRatio)
  const cjkChars = text.length * cjkRatio

  const englishTokens = englishChars / 4
  const cjkTokens = cjkChars / 1.5 // CJK characters are typically 1-2 tokens each

  return Math.ceil(englishTokens + cjkTokens)
}

/**
 * Estimate cost from token counts for a specific model
 */
export function estimateCostForTokens(
  inputTokens: number,
  outputTokens: number,
  _providerConfigId: string,
  modelId: string
): CostEstimate {
  const pricing = getModelPricing(modelId)
  const inputCostUsd = (inputTokens / 1_000_000) * pricing.input
  const outputCostUsd = (outputTokens / 1_000_000) * pricing.output

  return {
    inputTokens,
    outputTokens,
    inputCostUsd,
    outputCostUsd,
    totalCostUsd: inputCostUsd + outputCostUsd,
    configBreakdown: [],
    warnings: [],
  }
}

/**
 * Get pricing for a model
 */
export function getModelPricing(modelId: string): { input: number; output: number } {
  // Try exact match first
  if (MODEL_PRICING[modelId]) {
    return MODEL_PRICING[modelId]
  }

  // Try prefix match (for versioned model names)
  for (const [key, pricing] of Object.entries(MODEL_PRICING)) {
    if (modelId.startsWith(key) || key.startsWith(modelId)) {
      return pricing
    }
  }

  // Default fallback pricing
  return { input: 1, output: 3 }
}

/**
 * Estimate cost for a single translation
 */
export function estimateSingleCost(
  text: string,
  config: TranslationConfig,
  systemPromptLength = 500 // Default system prompt overhead
): { inputTokens: number; outputTokens: number; costUsd: number } {
  const textTokens = estimateTokens(text)
  const systemTokens = estimateTokens(config.systemPrompt || '') + systemPromptLength
  const inputTokens = textTokens + systemTokens

  // Output is typically similar length to input for translation, add 20% buffer
  const outputTokens = Math.ceil(textTokens * 1.2)

  const pricing = getModelPricing(config.modelId)
  const inputCost = (inputTokens / 1_000_000) * pricing.input
  const outputCost = (outputTokens / 1_000_000) * pricing.output

  return {
    inputTokens,
    outputTokens,
    costUsd: inputCost + outputCost,
  }
}

/**
 * Estimate cost for a translation with fallback chain
 */
export function estimateChainCost(text: string, configId: string, maxDepth = 3): CostEstimate {
  const config = getConfig(configId)
  if (!config) {
    return {
      inputTokens: 0,
      outputTokens: 0,
      inputCostUsd: 0,
      outputCostUsd: 0,
      totalCostUsd: 0,
      configBreakdown: [],
      warnings: ['Config not found'],
    }
  }

  const configBreakdown: CostEstimate['configBreakdown'] = []
  const warnings: string[] = []
  const visited = new Set<string>()

  // Calculate costs for primary config and fallbacks
  let currentConfigId: string | null = configId
  let depth = 0
  let probability = 1.0

  while (currentConfigId && depth < maxDepth && !visited.has(currentConfigId)) {
    visited.add(currentConfigId)
    const currentConfig = getConfig(currentConfigId)

    if (!currentConfig) break

    const estimate = estimateSingleCost(text, currentConfig)

    configBreakdown.push({
      configId: currentConfigId,
      configName: currentConfig.name,
      probability,
      estimatedCostUsd: estimate.costUsd * probability,
    })

    // Get fallbacks for next iteration
    const fallbacks = getFallbacksForConfig(currentConfigId)
    if (fallbacks.length > 0) {
      // Assume ~20% chance of needing fallback
      probability *= 0.2
      currentConfigId = fallbacks[0].fallbackConfigId
    } else {
      currentConfigId = null
    }

    depth++
  }

  // Calculate totals
  const primaryEstimate = estimateSingleCost(text, config)
  const totalCostUsd = configBreakdown.reduce((sum, c) => sum + c.estimatedCostUsd, 0)

  return {
    inputTokens: primaryEstimate.inputTokens,
    outputTokens: primaryEstimate.outputTokens,
    inputCostUsd: (primaryEstimate.inputTokens / 1_000_000) * getModelPricing(config.modelId).input,
    outputCostUsd:
      (primaryEstimate.outputTokens / 1_000_000) * getModelPricing(config.modelId).output,
    totalCostUsd,
    configBreakdown,
    warnings,
  }
}

/**
 * Estimate cost for multiple chapters
 */
export function estimateBatchCost(
  texts: string[],
  configId: string
): CostEstimate & { perChapter: number[] } {
  const perChapter: number[] = []
  let totalInputTokens = 0
  let totalOutputTokens = 0

  const config = getConfig(configId)
  if (!config) {
    return {
      inputTokens: 0,
      outputTokens: 0,
      inputCostUsd: 0,
      outputCostUsd: 0,
      totalCostUsd: 0,
      configBreakdown: [],
      warnings: ['Config not found'],
      perChapter: [],
    }
  }

  for (const text of texts) {
    const estimate = estimateSingleCost(text, config)
    perChapter.push(estimate.costUsd)
    totalInputTokens += estimate.inputTokens
    totalOutputTokens += estimate.outputTokens
  }

  const pricing = getModelPricing(config.modelId)
  const inputCostUsd = (totalInputTokens / 1_000_000) * pricing.input
  const outputCostUsd = (totalOutputTokens / 1_000_000) * pricing.output

  return {
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
    inputCostUsd,
    outputCostUsd,
    totalCostUsd: inputCostUsd + outputCostUsd,
    configBreakdown: [
      {
        configId,
        configName: config.name,
        probability: 1.0,
        estimatedCostUsd: inputCostUsd + outputCostUsd,
      },
    ],
    warnings: [],
    perChapter,
  }
}

/**
 * Check if a translation is within budget
 */
export function checkBudget(
  projectId: string,
  estimatedCostUsd: number
): { allowed: boolean; warning?: string; remaining?: number } {
  return checkProjectBudget(projectId, estimatedCostUsd)
}

/**
 * Format cost for display
 */
export function formatCost(costUsd: number): string {
  if (costUsd < 0.01) {
    return `$${(costUsd * 100).toFixed(2)}¢`
  }
  return `$${costUsd.toFixed(4)}`
}

/**
 * Format tokens for display
 */
export function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(2)}M`
  }
  if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(1)}K`
  }
  return String(tokens)
}
