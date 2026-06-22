import { GoogleGenerativeAI } from '@google/generative-ai'
import type {
  TranslationProvider,
  ProviderTranslationRequest,
  ProviderTranslationResult,
} from './types'
import type { ProviderSettings } from '../../shared/types'

export class GeminiProvider implements TranslationProvider {
  readonly id = 'gemini'
  readonly name = 'Google Gemini'
  private baseUrl?: string
  private settings: ProviderSettings = {}

  /**
   * Configure the provider with custom settings
   * Note: Google Generative AI SDK has limited base URL support
   */
  configure(baseUrl?: string, settings?: ProviderSettings): void {
    this.baseUrl = baseUrl
    if (settings) {
      this.settings = settings
    }
  }

  async translate(request: ProviderTranslationRequest): Promise<ProviderTranslationResult> {
    const genAI = new GoogleGenerativeAI(request.apiKey)
    const baseUrl = request.baseUrl || this.baseUrl
    const model = genAI.getGenerativeModel(
      {
        model: request.modelId,
        systemInstruction: request.systemPrompt,
      },
      {
        baseUrl,
        timeout: this.settings.timeout,
        customHeaders: this.settings.customHeaders
          ? new Headers(this.settings.customHeaders)
          : undefined,
      }
    )

    try {
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: request.userPrompt }] }],
        generationConfig: {
          temperature: request.temperature,
          maxOutputTokens: request.maxTokens,
        },
      })

      const response = result.response
      const text = response.text()
      const usage = response.usageMetadata

      return {
        translatedText: text,
        tokensUsed: {
          input: usage?.promptTokenCount || 0,
          output: usage?.candidatesTokenCount || 0,
          total: usage?.totalTokenCount || 0,
        },
        finishReason: 'stop',
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
    // Rough estimation for Gemini
    return Math.ceil(text.length / 4)
  }

  async validateKey(key: string, _baseUrl?: string): Promise<boolean> {
    const genAI = new GoogleGenerativeAI(key)

    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
      await model.generateContent('test')
      return true
    } catch {
      return false
    }
  }
}
