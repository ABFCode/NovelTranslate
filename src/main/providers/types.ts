/**
 * Translation Provider Interface
 * 
 * All LLM providers must implement this interface to be used for translation.
 */

export interface TranslationProvider {
  readonly id: string
  readonly name: string

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
  validateKey(key: string): Promise<boolean>
}

export interface ProviderTranslationRequest {
  modelId: string
  systemPrompt: string
  userPrompt: string
  temperature: number
  maxTokens?: number
  apiKey: string
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
    console.log(`[Providers] Registered: ${provider.name}`)
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
