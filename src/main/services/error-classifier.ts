/**
 * Error Classifier Service
 *
 * Parses provider-specific errors and categorizes them into standard error types.
 * This enables intelligent fallback decisions based on error type.
 */

import type { ErrorType } from '../../shared/types'

export interface ClassificationResult {
  errorType: ErrorType
  retryAfterMs?: number
  details?: string
  isRetryable: boolean
}

/**
 * Default retryable error types
 */
export const DEFAULT_RETRYABLE_ERRORS: ErrorType[] = ['rate_limit', 'timeout', 'network_error']

/**
 * Classify an error into a standard error type
 * @param error The error to classify
 * @param sdkType The SDK type used (openai, anthropic, gemini, openai_compatible)
 */
export function classifyError(error: unknown, sdkType: string): ClassificationResult {
  const errorMessage = extractErrorMessage(error)
  const errorCode = extractErrorCode(error)
  const statusCode = extractStatusCode(error)

  // SDK-specific classification
  switch (sdkType) {
    case 'openai':
    case 'openai_compatible':
      return classifyOpenAIError(error, errorMessage, errorCode, statusCode)
    case 'anthropic':
      return classifyAnthropicError(error, errorMessage, errorCode, statusCode)
    case 'gemini':
    case 'google':
      return classifyGeminiError(error, errorMessage, errorCode, statusCode)
    default:
      return classifyGenericError(errorMessage, statusCode)
  }
}

/**
 * Check if an error type is retryable
 */
export function isRetryableError(
  errorType: ErrorType,
  retryableErrors: ErrorType[] = DEFAULT_RETRYABLE_ERRORS
): boolean {
  return retryableErrors.includes(errorType)
}

// ============================================================================
// Provider-Specific Classifiers
// ============================================================================

function classifyOpenAIError(
  error: unknown,
  message: string,
  code?: string,
  statusCode?: number
): ClassificationResult {
  // OpenAI API error codes: https://platform.openai.com/docs/guides/error-codes

  // Content policy violation
  if (code === 'content_policy_violation' || message.toLowerCase().includes('content policy')) {
    return {
      errorType: 'content_block',
      details: message,
      isRetryable: false,
    }
  }

  // Rate limit
  if (
    code === 'rate_limit_exceeded' ||
    statusCode === 429 ||
    message.toLowerCase().includes('rate limit')
  ) {
    return {
      errorType: 'rate_limit',
      retryAfterMs: extractRetryAfter(error) || 60000,
      details: message,
      isRetryable: true,
    }
  }

  // Context length exceeded
  if (
    code === 'context_length_exceeded' ||
    message.toLowerCase().includes('context length') ||
    message.toLowerCase().includes('maximum context')
  ) {
    return {
      errorType: 'context_length',
      details: message,
      isRetryable: false,
    }
  }

  // Authentication error
  if (
    code === 'invalid_api_key' ||
    statusCode === 401 ||
    message.toLowerCase().includes('incorrect api key') ||
    message.toLowerCase().includes('invalid api key')
  ) {
    return {
      errorType: 'auth_error',
      details: message,
      isRetryable: false,
    }
  }

  // Quota exceeded
  if (code === 'insufficient_quota' || message.toLowerCase().includes('quota')) {
    return {
      errorType: 'quota_exceeded',
      details: message,
      isRetryable: false,
    }
  }

  // Model not found
  if (code === 'model_not_found' || message.toLowerCase().includes('does not exist')) {
    return {
      errorType: 'model_unavailable',
      details: message,
      isRetryable: false,
    }
  }

  // Timeout
  if (
    message.toLowerCase().includes('timeout') ||
    message.toLowerCase().includes('etimedout') ||
    message.toLowerCase().includes('econnreset')
  ) {
    return {
      errorType: 'timeout',
      isRetryable: true,
    }
  }

  // Network error
  if (
    message.toLowerCase().includes('network') ||
    message.toLowerCase().includes('enotfound') ||
    message.toLowerCase().includes('econnrefused')
  ) {
    return {
      errorType: 'network_error',
      isRetryable: true,
    }
  }

  // Server error (5xx)
  if (statusCode && statusCode >= 500) {
    return {
      errorType: 'network_error',
      details: `Server error: ${statusCode}`,
      isRetryable: true,
    }
  }

  return {
    errorType: 'unknown',
    details: message,
    isRetryable: false,
  }
}

function classifyAnthropicError(
  error: unknown,
  message: string,
  code?: string,
  statusCode?: number
): ClassificationResult {
  // Content blocked
  if (
    code === 'content_blocked' ||
    (message.toLowerCase().includes('content') && message.toLowerCase().includes('block'))
  ) {
    return {
      errorType: 'content_block',
      details: message,
      isRetryable: false,
    }
  }

  // Rate limit
  if (
    code === 'rate_limit_error' ||
    statusCode === 429 ||
    message.toLowerCase().includes('rate limit')
  ) {
    return {
      errorType: 'rate_limit',
      retryAfterMs: extractRetryAfter(error) || 60000,
      details: message,
      isRetryable: true,
    }
  }

  // Authentication error
  if (code === 'authentication_error' || statusCode === 401) {
    return {
      errorType: 'auth_error',
      details: message,
      isRetryable: false,
    }
  }

  // Context length / too long
  if (
    message.toLowerCase().includes('context') ||
    message.toLowerCase().includes('too long') ||
    message.toLowerCase().includes('exceeds')
  ) {
    return {
      errorType: 'context_length',
      details: message,
      isRetryable: false,
    }
  }

  // Overloaded (Anthropic-specific)
  if (code === 'overloaded_error' || message.toLowerCase().includes('overloaded')) {
    return {
      errorType: 'rate_limit',
      retryAfterMs: 30000,
      details: 'API overloaded',
      isRetryable: true,
    }
  }

  // Timeout
  if (message.toLowerCase().includes('timeout')) {
    return {
      errorType: 'timeout',
      isRetryable: true,
    }
  }

  // Server error
  if (statusCode && statusCode >= 500) {
    return {
      errorType: 'network_error',
      details: `Server error: ${statusCode}`,
      isRetryable: true,
    }
  }

  return {
    errorType: 'unknown',
    details: message,
    isRetryable: false,
  }
}

function classifyGeminiError(
  _error: unknown,
  message: string,
  _code?: string,
  statusCode?: number
): ClassificationResult {
  // Safety blocked
  if (
    message.toLowerCase().includes('safety') ||
    message.toLowerCase().includes('blocked') ||
    message.toLowerCase().includes('harm')
  ) {
    return {
      errorType: 'content_block',
      details: message,
      isRetryable: false,
    }
  }

  // Rate limit / quota
  if (
    message.toLowerCase().includes('resource_exhausted') ||
    message.toLowerCase().includes('quota') ||
    statusCode === 429
  ) {
    return {
      errorType: 'rate_limit',
      retryAfterMs: 60000, // Default 60s for Gemini
      details: message,
      isRetryable: true,
    }
  }

  // Authentication
  if (
    (message.toLowerCase().includes('invalid_argument') &&
      message.toLowerCase().includes('api key')) ||
    statusCode === 401
  ) {
    return {
      errorType: 'auth_error',
      details: message,
      isRetryable: false,
    }
  }

  // Model not found
  if (
    message.toLowerCase().includes('not found') ||
    message.toLowerCase().includes('invalid model')
  ) {
    return {
      errorType: 'model_unavailable',
      details: message,
      isRetryable: false,
    }
  }

  // Context length
  if (
    (message.toLowerCase().includes('token') && message.toLowerCase().includes('limit')) ||
    message.toLowerCase().includes('too long')
  ) {
    return {
      errorType: 'context_length',
      details: message,
      isRetryable: false,
    }
  }

  // Server error
  if (statusCode && statusCode >= 500) {
    return {
      errorType: 'network_error',
      details: `Server error: ${statusCode}`,
      isRetryable: true,
    }
  }

  return {
    errorType: 'unknown',
    details: message,
    isRetryable: false,
  }
}

function classifyGenericError(message: string, statusCode?: number): ClassificationResult {
  const lowerMessage = message.toLowerCase()

  // Rate limit patterns
  if (
    lowerMessage.includes('rate limit') ||
    lowerMessage.includes('too many requests') ||
    statusCode === 429
  ) {
    return {
      errorType: 'rate_limit',
      retryAfterMs: 60000,
      isRetryable: true,
    }
  }

  // Auth patterns
  if (
    lowerMessage.includes('unauthorized') ||
    lowerMessage.includes('invalid key') ||
    statusCode === 401
  ) {
    return {
      errorType: 'auth_error',
      isRetryable: false,
    }
  }

  // Timeout patterns
  if (lowerMessage.includes('timeout') || lowerMessage.includes('etimedout')) {
    return {
      errorType: 'timeout',
      isRetryable: true,
    }
  }

  // Network patterns
  if (
    lowerMessage.includes('network') ||
    lowerMessage.includes('econnrefused') ||
    lowerMessage.includes('enotfound')
  ) {
    return {
      errorType: 'network_error',
      isRetryable: true,
    }
  }

  // Content block patterns
  if (
    lowerMessage.includes('content') &&
    (lowerMessage.includes('block') || lowerMessage.includes('policy'))
  ) {
    return {
      errorType: 'content_block',
      isRetryable: false,
    }
  }

  // Server errors
  if (statusCode && statusCode >= 500) {
    return {
      errorType: 'network_error',
      details: `Server error: ${statusCode}`,
      isRetryable: true,
    }
  }

  return {
    errorType: 'unknown',
    details: message,
    isRetryable: false,
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function extractErrorMessage(error: unknown): string {
  if (typeof error === 'string') {
    return error
  }

  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'object' && error !== null) {
    const obj = error as Record<string, unknown>

    // Try common error message fields
    if (typeof obj.message === 'string') return obj.message
    if (typeof obj.error === 'string') return obj.error
    if (typeof obj.error === 'object' && obj.error !== null) {
      const innerError = obj.error as Record<string, unknown>
      if (typeof innerError.message === 'string') return innerError.message
    }

    return JSON.stringify(error)
  }

  return String(error)
}

function extractErrorCode(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null) {
    const obj = error as Record<string, unknown>

    if (typeof obj.code === 'string') return obj.code
    if (typeof obj.error_code === 'string') return obj.error_code
    if (typeof obj.type === 'string') return obj.type

    if (typeof obj.error === 'object' && obj.error !== null) {
      const innerError = obj.error as Record<string, unknown>
      if (typeof innerError.code === 'string') return innerError.code
      if (typeof innerError.type === 'string') return innerError.type
    }
  }

  return undefined
}

function extractStatusCode(error: unknown): number | undefined {
  if (typeof error === 'object' && error !== null) {
    const obj = error as Record<string, unknown>

    if (typeof obj.status === 'number') return obj.status
    if (typeof obj.statusCode === 'number') return obj.statusCode
    if (typeof obj.status_code === 'number') return obj.status_code

    if (typeof obj.response === 'object' && obj.response !== null) {
      const response = obj.response as Record<string, unknown>
      if (typeof response.status === 'number') return response.status
    }
  }

  return undefined
}

function extractRetryAfter(error: unknown): number | undefined {
  if (typeof error === 'object' && error !== null) {
    const obj = error as Record<string, unknown>

    // Check for retry-after header value
    if (typeof obj.retryAfter === 'number') return obj.retryAfter * 1000
    if (typeof obj.retry_after === 'number') return obj.retry_after * 1000

    // Check in headers
    if (typeof obj.headers === 'object' && obj.headers !== null) {
      const headers = obj.headers as Record<string, unknown>
      const retryAfter = headers['retry-after'] || headers['Retry-After']
      if (typeof retryAfter === 'string') {
        const seconds = parseInt(retryAfter, 10)
        if (!isNaN(seconds)) return seconds * 1000
      }
    }
  }

  return undefined
}
