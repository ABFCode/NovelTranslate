/**
 * Retry Strategy Service
 *
 * Handles retry logic with different backoff strategies.
 */

import type { RetryConfig, RetryStrategyType, ErrorType } from '../../shared/types'
import { classifyError, isRetryableError } from './error-classifier'

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: Omit<RetryConfig, 'id' | 'configId' | 'createdAt'> = {
  strategy: 'exponential_jitter',
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 60000,
  jitterFactor: 0.2,
  retryableErrors: ['rate_limit', 'timeout', 'network_error']
}

/**
 * Calculate the delay before the next retry attempt
 */
export function calculateDelay(
  attempt: number,
  config: Pick<RetryConfig, 'strategy' | 'baseDelayMs' | 'maxDelayMs' | 'jitterFactor'>,
  serverRetryAfterMs?: number
): number {
  // Always respect server's retry-after header if present
  if (serverRetryAfterMs && serverRetryAfterMs > 0) {
    return Math.min(serverRetryAfterMs, config.maxDelayMs)
  }

  let delay: number

  switch (config.strategy) {
    case 'none':
      return 0

    case 'immediate':
      delay = 0
      break

    case 'linear':
      delay = config.baseDelayMs * attempt
      break

    case 'exponential':
      delay = config.baseDelayMs * Math.pow(2, attempt - 1)
      break

    case 'exponential_jitter':
    default:
      const exponential = config.baseDelayMs * Math.pow(2, attempt - 1)
      const jitter = exponential * config.jitterFactor * Math.random()
      delay = exponential + jitter
      break
  }

  return Math.min(delay, config.maxDelayMs)
}

/**
 * Determine if we should retry based on error and config
 */
export function shouldRetry(
  error: unknown,
  sdkType: string,
  attempt: number,
  config: Pick<RetryConfig, 'strategy' | 'maxAttempts' | 'retryableErrors'>
): { shouldRetry: boolean; errorType: ErrorType; retryAfterMs?: number } {
  // No retries if strategy is none
  if (config.strategy === 'none') {
    const classification = classifyError(error, sdkType)
    return { shouldRetry: false, errorType: classification.errorType }
  }

  // Max attempts reached
  if (attempt >= config.maxAttempts) {
    const classification = classifyError(error, sdkType)
    return { shouldRetry: false, errorType: classification.errorType }
  }

  // Classify the error
  const classification = classifyError(error, sdkType)

  // Check if this error type is retryable
  const canRetry = isRetryableError(classification.errorType, config.retryableErrors)

  return {
    shouldRetry: canRetry,
    errorType: classification.errorType,
    retryAfterMs: classification.retryAfterMs
  }
}

/**
 * Execute a function with retry logic
 */
export async function executeWithRetry<T>(
  fn: () => Promise<T>,
  sdkType: string,
  config: RetryConfig,
  onRetry?: (attempt: number, error: unknown, delayMs: number) => void
): Promise<{ result?: T; error?: unknown; attempts: number; errorType?: ErrorType }> {
  let lastError: unknown
  let lastErrorType: ErrorType | undefined

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      const result = await fn()
      return { result, attempts: attempt }
    } catch (error) {
      lastError = error

      const { shouldRetry: retry, errorType, retryAfterMs } = shouldRetry(
        error,
        sdkType,
        attempt,
        config
      )

      lastErrorType = errorType

      if (!retry || attempt >= config.maxAttempts) {
        break
      }

      // Calculate delay
      const delayMs = calculateDelay(attempt, config, retryAfterMs)

      // Notify about retry
      if (onRetry) {
        onRetry(attempt, error, delayMs)
      }

      // Wait before retrying
      if (delayMs > 0) {
        await sleep(delayMs)
      }
    }
  }

  return { error: lastError, attempts: config.maxAttempts, errorType: lastErrorType }
}

/**
 * Create a retry executor with a fixed config
 */
export function createRetryExecutor(config: RetryConfig) {
  return async <T>(
    fn: () => Promise<T>,
    sdkType: string,
    onRetry?: (attempt: number, error: unknown, delayMs: number) => void
  ) => executeWithRetry(fn, sdkType, config, onRetry)
}

/**
 * Get human-readable description of retry strategy
 */
export function getStrategyDescription(strategy: RetryStrategyType): string {
  switch (strategy) {
    case 'none':
      return 'No retries - fail immediately on error'
    case 'immediate':
      return 'Retry immediately without delay'
    case 'linear':
      return 'Linear backoff - delay increases by base delay each attempt'
    case 'exponential':
      return 'Exponential backoff - delay doubles each attempt'
    case 'exponential_jitter':
      return 'Exponential backoff with jitter - recommended for rate limits'
  }
}

/**
 * Get recommended strategy for an error type
 */
export function getRecommendedStrategy(errorType: ErrorType): RetryStrategyType {
  switch (errorType) {
    case 'rate_limit':
      return 'exponential_jitter'
    case 'timeout':
      return 'immediate'
    case 'network_error':
      return 'linear'
    default:
      return 'none'
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
