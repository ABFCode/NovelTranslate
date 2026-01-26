import { providerRegistry } from './types'
import { OpenAIProvider } from './openai.provider'
import { GeminiProvider } from './gemini.provider'
import { AnthropicProvider } from './anthropic.provider'

export * from './types'

/**
 * Register all available translation providers
 */
export function registerProviders(): void {
  providerRegistry.register(new OpenAIProvider())
  providerRegistry.register(new GeminiProvider())
  providerRegistry.register(new AnthropicProvider())

  console.log('[Providers] All providers registered')
}
