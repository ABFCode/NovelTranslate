import Anthropic from '@anthropic-ai/sdk'
import type {
  TranslationProvider,
  ProviderTranslationRequest,
  ProviderTranslationResult,
} from './types'

export class AnthropicProvider implements TranslationProvider {
  readonly id = 'anthropic'
  readonly name = 'Anthropic'

  async translate(request: ProviderTranslationRequest): Promise<ProviderTranslationResult> {
    const client = new Anthropic({ apiKey: request.apiKey })

    try {
      const response = await client.messages.create({
        model: request.modelId,
        system: request.systemPrompt,
        messages: [{ role: 'user', content: request.userPrompt }],
        temperature: request.temperature,
        max_tokens: request.maxTokens || 4096,
      })

      const textContent = response.content.find((c) => c.type === 'text')
      const text = textContent?.type === 'text' ? textContent.text : ''

      return {
        translatedText: text,
        tokensUsed: {
          input: response.usage.input_tokens,
          output: response.usage.output_tokens,
          total: response.usage.input_tokens + response.usage.output_tokens,
        },
        finishReason: response.stop_reason === 'end_turn' ? 'stop' : 'length',
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
    // Rough estimation for Anthropic
    return Math.ceil(text.length / 4)
  }

  async validateKey(key: string): Promise<boolean> {
    const client = new Anthropic({ apiKey: key })

    try {
      // Make a minimal API call to validate
      await client.messages.create({
        model: 'claude-3-5-haiku-latest',
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 10,
      })
      return true
    } catch {
      return false
    }
  }
}
