import { GoogleGenerativeAI } from '@google/generative-ai'
import type { ModelInfo, ProviderSettings } from '../../shared/types'
import {
  describeProviderError,
  type ProviderTranslationRequest,
  type ProviderTranslationResult,
  type TranslationProvider,
} from './types'

const GEMINI_DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com'

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

  async validateKey(key: string, baseUrl?: string): Promise<boolean> {
    try {
      // Listing models is a cheap, read-only check that doesn't depend on a
      // specific model ID being current.
      await this.listModels(key, baseUrl)
      return true
    } catch {
      return false
    }
  }

  async listModels(apiKey: string, baseUrl?: string): Promise<ModelInfo[]> {
    const root = (baseUrl || this.baseUrl || GEMINI_DEFAULT_BASE_URL).replace(/\/+$/, '')
    const url = `${root}/v1beta/models?key=${encodeURIComponent(apiKey)}&pageSize=200`

    try {
      const res = await fetch(url, {
        headers: this.settings.customHeaders,
      })
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }
      const data = (await res.json()) as {
        models?: Array<{
          name: string
          displayName?: string
          inputTokenLimit?: number
          supportedGenerationMethods?: string[]
        }>
      }

      const models: ModelInfo[] = []
      for (const m of data.models ?? []) {
        if (!m.supportedGenerationMethods?.includes('generateContent')) {
          continue
        }
        const id = m.name.replace(/^models\//, '')
        models.push({
          id,
          name: m.displayName ?? id,
          contextWindow: m.inputTokenLimit ?? 0,
        })
      }
      return models.sort((a, b) => a.id.localeCompare(b.id))
    } catch (error) {
      throw new Error(describeProviderError(error))
    }
  }
}
