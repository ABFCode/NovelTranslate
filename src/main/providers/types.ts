/**
 * Translation Provider Interface
 *
 * All LLM providers must implement this interface to be used for translation.
 */

import { logger } from '../services/logger'
import type { ProviderSettings, ModelInfo } from '../../shared/types'

export interface TranslationProvider {
  readonly id: string
  readonly name: string

  /**
   * Configure the provider with custom base URL and settings
   */
  configure?(baseUrl?: string, settings?: ProviderSettings): void

  /**
   * Translate text using this provider
   */
  translate(request: ProviderTranslationRequest): Promise<ProviderTranslationResult>

  /**
   * Estimate token count for text
   */
  estimateTokens(text: string, modelId: string): number

  /**
   * Validate an API key
   */
  validateKey(key: string, baseUrl?: string): Promise<boolean>

  /**
   * List the models available for this provider/key.
   * Implementations should throw a descriptive error on failure (e.g. HTTP 500,
   * changed response shape) so callers can surface it without crashing.
   */
  listModels?(apiKey: string, baseUrl?: string): Promise<ModelInfo[]>
}

/**
 * Produce a concise, human-readable message from a provider/SDK error.
 * Includes an HTTP status code when the SDK exposes one.
 */
export function describeProviderError(error: unknown): string {
  if (error instanceof Error) {
    const status = (error as { status?: number }).status
    return status ? `HTTP ${status}: ${error.message}` : error.message
  }
  return String(error)
}

export interface ProviderTranslationRequest {
  modelId: string
  systemPrompt: string
  userPrompt: string
  temperature: number
  maxTokens?: number
  apiKey: string
  /** Optional base URL override for this request (custom/compatible endpoints) */
  baseUrl?: string
}

export interface ProviderTranslationResult {
  translatedText: string
  tokensUsed: {
    input: number
    output: number
    total: number
  }
  finishReason: 'stop' | 'length' | 'error'
  error?: string
}

/**
 * Provider Registry
 */
class ProviderRegistry {
  private providers = new Map<string, TranslationProvider>()

  register(provider: TranslationProvider): void {
    this.providers.set(provider.id, provider)
    logger.info(`[Providers] Registered: ${provider.name}`)
  }

  get(id: string): TranslationProvider | undefined {
    return this.providers.get(id)
  }

  getAll(): TranslationProvider[] {
    return Array.from(this.providers.values())
  }

  has(id: string): boolean {
    return this.providers.has(id)
  }
}

export const providerRegistry = new ProviderRegistry()
