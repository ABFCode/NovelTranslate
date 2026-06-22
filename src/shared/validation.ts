/**
 * Zod validation schemas for forms throughout the application
 */

import { z } from 'zod'

// ============================================================================
// Translation Config Schemas
// ============================================================================

export const translationConfigSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be 100 characters or less'),
  providerConfigId: z.string().min(1, 'Please select a provider'),
  modelId: z.string().min(1, 'Please select a model'),
  systemPrompt: z.string().max(50000, 'System prompt is too long'),
  userPromptTemplate: z
    .string()
    .min(1, 'User prompt template is required')
    .max(50000, 'User prompt template is too long')
    .refine(
      (val) => val.includes('{{text}}'),
      'Template must include {{text}} variable for the source text'
    ),
  temperature: z
    .number()
    .min(0, 'Temperature must be at least 0')
    .max(2, 'Temperature must be at most 2'),
  maxTokens: z
    .number()
    .int('Max tokens must be a whole number')
    .positive('Max tokens must be positive')
    .optional()
    .nullable()
})

export type TranslationConfigFormData = z.infer<typeof translationConfigSchema>

// ============================================================================
// Config Fallback Schemas
// ============================================================================

export const configFallbackSchema = z.object({
  fallbackConfigId: z.string().min(1, 'Please select a fallback config'),
  priority: z.number().int().min(0, 'Priority must be 0 or greater'),
  conditionType: z.enum([
    'any',
    'content_block',
    'rate_limit',
    'timeout',
    'auth_error',
    'quota_exceeded',
    'context_length',
    'network_error'
  ]),
  conditionValue: z.string().optional()
})

export type ConfigFallbackFormData = z.infer<typeof configFallbackSchema>

// ============================================================================
// Glossary Term Schemas
// ============================================================================

export const glossaryTermSchema = z.object({
  sourceTerm: z
    .string()
    .min(1, 'Source term is required')
    .max(500, 'Source term is too long'),
  targetTerm: z
    .string()
    .min(1, 'Target term is required')
    .max(500, 'Target term is too long'),
  termType: z.enum(['name', 'place', 'skill', 'item', 'honorific', 'other']),
  gender: z.enum(['male', 'female', 'neutral', 'unknown']).optional().nullable(),
  pronouns: z.string().max(50, 'Pronouns field is too long').optional().nullable(),
  aliases: z.array(z.string().max(500)).max(20, 'Too many aliases'),
  context: z.string().max(1000, 'Context is too long').optional().nullable(),
  notes: z.string().max(2000, 'Notes are too long').optional().nullable()
})

export type GlossaryTermFormData = z.infer<typeof glossaryTermSchema>

// ============================================================================
// Project Budget Schemas
// ============================================================================

export const projectBudgetSchema = z.object({
  budgetUsd: z
    .number()
    .min(0, 'Budget must be 0 or greater')
    .max(10000, 'Budget seems unreasonably high'),
  alertThreshold: z
    .number()
    .min(0, 'Alert threshold must be between 0 and 1')
    .max(1, 'Alert threshold must be between 0 and 1'),
  hardLimit: z.boolean()
})

export type ProjectBudgetFormData = z.infer<typeof projectBudgetSchema>

// ============================================================================
// Test Run Schemas
// ============================================================================

export const testRunSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be 100 characters or less'),
  sampleText: z
    .string()
    .min(1, 'Sample text is required')
    .max(100000, 'Sample text is too long'),
  sourceLanguage: z.string().min(1, 'Source language is required'),
  targetLanguage: z.string().min(1, 'Target language is required'),
  configIds: z.array(z.string()).min(1, 'Select at least one config to test')
})

export type TestRunFormData = z.infer<typeof testRunSchema>

// ============================================================================
// API Key Schemas
// ============================================================================

export const apiKeySchema = z.object({
  providerConfigId: z.string().min(1, 'Please select a provider'),
  keyValue: z
    .string()
    .min(1, 'API key is required')
    .max(500, 'API key is too long'),
  label: z.string().max(100, 'Label is too long').optional().nullable(),
  priority: z.number().int().min(0, 'Priority must be 0 or greater').default(0),
  isEnabled: z.boolean().default(true)
})

export type ApiKeyFormData = z.infer<typeof apiKeySchema>

// ============================================================================
// Retry Config Schemas
// ============================================================================

export const retryConfigSchema = z.object({
  strategy: z.enum(['none', 'immediate', 'linear', 'exponential', 'exponential_jitter']),
  maxAttempts: z
    .number()
    .int('Max attempts must be a whole number')
    .min(1, 'Max attempts must be at least 1')
    .max(10, 'Max attempts should not exceed 10'),
  baseDelayMs: z
    .number()
    .int('Base delay must be a whole number')
    .min(0, 'Base delay must be 0 or greater')
    .max(60000, 'Base delay should not exceed 60 seconds'),
  maxDelayMs: z
    .number()
    .int('Max delay must be a whole number')
    .min(1000, 'Max delay must be at least 1 second')
    .max(300000, 'Max delay should not exceed 5 minutes'),
  jitterFactor: z
    .number()
    .min(0, 'Jitter factor must be between 0 and 1')
    .max(1, 'Jitter factor must be between 0 and 1'),
  retryableErrors: z
    .array(
      z.enum([
        'content_block',
        'rate_limit',
        'timeout',
        'auth_error',
        'quota_exceeded',
        'context_length',
        'network_error',
        'unknown'
      ])
    )
    .min(1, 'Select at least one error type to retry')
})

export type RetryConfigFormData = z.infer<typeof retryConfigSchema>

// ============================================================================
// Settings Schemas
// ============================================================================

export const appSettingsSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']),
  uiMode: z.enum(['simple', 'advanced']),
  defaultConfigId: z.string().optional().nullable(),
  translationConcurrency: z
    .number()
    .int()
    .min(1, 'Concurrency must be at least 1')
    .max(10, 'Concurrency should not exceed 10'),
  autoSaveInterval: z
    .number()
    .int()
    .min(5000, 'Auto-save interval must be at least 5 seconds')
    .max(300000, 'Auto-save interval should not exceed 5 minutes'),
  keyRotationStrategy: z.enum(['priority', 'round_robin', 'least_recently_used']),
  enableTranslationMemory: z.boolean(),
  enableGlossaryInjection: z.boolean(),
  showCostEstimates: z.boolean()
})

export type AppSettingsFormData = z.infer<typeof appSettingsSchema>

// ============================================================================
// Prompt Template Schemas
// ============================================================================

export const promptTemplateSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be 100 characters or less'),
  description: z.string().max(500, 'Description is too long').optional().nullable(),
  category: z.enum(['literal', 'natural', 'specialized', 'custom']),
  systemPrompt: z.string().max(50000, 'System prompt is too long'),
  userPromptTemplate: z
    .string()
    .min(1, 'User prompt template is required')
    .max(50000, 'User prompt template is too long')
    .refine(
      (val) => val.includes('{{text}}'),
      'Template must include {{text}} variable'
    ),
  suggestedTemperature: z.number().min(0).max(2),
  suggestedMaxTokens: z.number().int().positive().optional().nullable()
})

export type PromptTemplateFormData = z.infer<typeof promptTemplateSchema>

// ============================================================================
// Translation Override Schemas
// ============================================================================

export const translationOverrideSchema = z.object({
  sourceSegment: z
    .string()
    .min(1, 'Source segment is required')
    .max(10000, 'Source segment is too long'),
  originalTranslation: z
    .string()
    .min(1, 'Original translation is required')
    .max(10000, 'Original translation is too long'),
  overrideTranslation: z
    .string()
    .min(1, 'Override translation is required')
    .max(10000, 'Override translation is too long'),
  scope: z.enum(['chapter', 'project', 'global']),
  reason: z.string().max(500, 'Reason is too long').optional().nullable()
})

export type TranslationOverrideFormData = z.infer<typeof translationOverrideSchema>

// ============================================================================
// Import/Export Schemas
// ============================================================================

export const configImportSchema = z.object({
  version: z.string(),
  exportedAt: z.string(),
  configs: z.array(
    z.object({
      name: z.string(),
      providerConfigId: z.string(),
      modelId: z.string(),
      systemPrompt: z.string(),
      userPromptTemplate: z.string(),
      temperature: z.number(),
      maxTokens: z.number().optional().nullable(),
      fallbacks: z
        .array(
          z.object({
            fallbackConfigName: z.string(),
            priority: z.number(),
            conditionType: z.string()
          })
        )
        .optional()
    })
  ),
  templates: z.array(z.unknown()).optional(),
  glossaryTerms: z.array(z.unknown()).optional()
})

export type ConfigImportData = z.infer<typeof configImportSchema>
