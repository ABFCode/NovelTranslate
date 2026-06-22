import OpenAI from 'openai'
import type {
  TranslationProvider,
  ProviderTranslationRequest,
  ProviderTranslationResult,
} from './types'
import type { ProviderSettings } from '../../shared/types'

export class OpenAIProvider implements TranslationProvider {
  readonly id = 'openai'
  readonly name = 'OpenAI'
  private baseUrl?: string
  private settings: ProviderSettings = {}

  /**
   * Configure the provider with custom base URL and settings
   */
  configure(baseUrl?: string, settings?: ProviderSettings): void {
    this.baseUrl = baseUrl
    if (settings) {
      this.settings = settings
    }
  }

  async translate(request: ProviderTranslationRequest): Promise<ProviderTranslationResult> {
    const client = new OpenAI({
      apiKey: request.apiKey,
      baseURL: request.baseUrl || this.baseUrl,
      timeout: this.settings.timeout,
      organization: this.settings.organizationId,
      defaultHeaders: this.settings.customHeaders
    })

    try {
      const response = await client.chat.completions.create({
        model: request.modelId,
        messages: [
          { role: 'system', content: request.systemPrompt },
          { role: 'user', content: request.userPrompt },
        ],
        temperature: request.temperature,
        max_tokens: request.maxTokens,
      })

      const choice = response.choices[0]
      const usage = response.usage

      return {
        translatedText: choice.message.content || '',
        tokensUsed: {
          input: usage?.prompt_tokens || 0,
          output: usage?.completion_tokens || 0,
          total: usage?.total_tokens || 0,
        },
        finishReason: choice.finish_reason === 'stop' ? 'stop' : 'length',
      }
    } catch (error) {
      return {
        translatedText: '',
        tokensUsed: { input: 0, output: 0, total: 0 },
        finishReason: 'error',
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  estimateTokens(text: string, _modelId: string): number {
    // Rough estimation: ~4 characters per token for English
    // This is approximate; for precise counts, use tiktoken
    return Math.ceil(text.length / 4)
  }

  async validateKey(key: string, baseUrl?: string): Promise<boolean> {
    const client = new OpenAI({
      apiKey: key,
      baseURL: baseUrl || this.baseUrl,
      timeout: this.settings.timeout,
      organization: this.settings.organizationId
    })

    try {
      // Make a minimal API call to validate the key
      await client.models.list()
      return true
    } catch {
      return false
    }
  }
}
