import OpenAI from 'openai'
import {
  describeProviderError,
  type TranslationProvider,
  type ProviderTranslationRequest,
  type ProviderTranslationResult,
} from './types'
import type { ModelInfo, ProviderSettings } from '../../shared/types'

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

  async listModels(apiKey: string, baseUrl?: string): Promise<ModelInfo[]> {
    const client = new OpenAI({
      apiKey,
      baseURL: baseUrl || this.baseUrl,
      timeout: this.settings.timeout,
      organization: this.settings.organizationId,
      defaultHeaders: this.settings.customHeaders
    })

    try {
      const response = await client.models.list()
      const models: ModelInfo[] = []
      for await (const model of response) {
        if (isChatModel(model.id)) {
          models.push({ id: model.id, name: model.id, contextWindow: 0 })
        }
      }
      return models.sort((a, b) => a.id.localeCompare(b.id))
    } catch (error) {
      throw new Error(describeProviderError(error))
    }
  }
}

/**
 * Heuristic filter to keep chat/completion models and drop embeddings, audio,
 * image, moderation, and other non-text endpoints from the models list.
 */
function isChatModel(modelId: string): boolean {
  const id = modelId.toLowerCase()
  const excluded = [
    'embedding',
    'whisper',
    'tts',
    'audio',
    'transcribe',
    'dall-e',
    'image',
    'moderation',
    'realtime',
    'search',
    'codex',
    'davinci',
    'babbage'
  ]
  if (excluded.some((term) => id.includes(term))) {
    return false
  }
  return id.startsWith('gpt') || id.startsWith('o1') || id.startsWith('o3') || id.startsWith('o4') || id.startsWith('chatgpt')
}
