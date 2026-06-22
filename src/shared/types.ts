// Shared types between main and renderer processes

// ============================================================================
// UI Mode
// ============================================================================

export type UIMode = 'simple' | 'advanced'

// ============================================================================
// Project Types
// ============================================================================

export interface Project {
  id: string
  name: string
  sourcePath: string
  sourceLanguage: string
  targetLanguage: string
  createdAt: string
  updatedAt: string
  metadata: ProjectMetadata
}

export interface ProjectMetadata {
  title?: string
  author?: string
  language?: string
  description?: string
  coverPath?: string
  totalChapters: number
  translatedChapters: number
}

// ============================================================================
// Chapter Types
// ============================================================================

export type ChapterStatus = 'pending' | 'translating' | 'translated' | 'error' | 'skipped'

export interface Chapter {
  id: string
  projectId: string
  spineIndex: number
  title: string
  status: ChapterStatus
  createdAt: string
  errorMessage?: string
  lastConfigId?: string
}

export interface ChapterContent {
  chapterId: string
  sourceText: string
  translatedText?: string
}

export interface ChapterWithContent extends Chapter {
  content: ChapterContent
}

// ============================================================================
// Error Classification
// ============================================================================

export type ErrorType =
  | 'content_block' // Safety filter triggered
  | 'rate_limit' // Too many requests
  | 'timeout' // Request timed out
  | 'auth_error' // Invalid/expired API key
  | 'quota_exceeded' // Billing/quota limits
  | 'model_unavailable' // Model doesn't exist or is down
  | 'context_length' // Input too long for model
  | 'network_error' // Connection issues
  | 'unknown' // Unclassified errors

export type FallbackConditionType = ErrorType | 'any'

// ============================================================================
// Retry Strategy
// ============================================================================

export type RetryStrategyType =
  | 'none'
  | 'immediate'
  | 'linear'
  | 'exponential'
  | 'exponential_jitter'

export interface RetryConfig {
  id: string
  configId?: string | null // null for global
  strategy: RetryStrategyType
  maxAttempts: number
  baseDelayMs: number
  maxDelayMs: number
  jitterFactor: number
  retryableErrors: ErrorType[]
  createdAt: string
}

// ============================================================================
// Translation Config Types
// ============================================================================

export interface TranslationConfig {
  id: string
  name: string
  providerConfigId: string
  modelId: string
  systemPrompt: string
  userPromptTemplate: string
  temperature: number
  maxTokens?: number
  isDefault?: boolean
  createdAt?: string
  updatedAt?: string
}

export interface ConfigFallback {
  id: string
  configId: string
  fallbackConfigId: string
  priority: number
  conditionType: FallbackConditionType
  conditionValue?: string
  createdAt: string
}

export interface ConfigSnapshot {
  id: string
  configId: string
  version: number
  name: string
  providerConfigId: string
  modelId: string
  systemPrompt: string
  userPromptTemplate: string
  temperature: number
  maxTokens?: number
  reason: 'edit' | 'test' | 'translation'
  createdAt: string
}

export interface ConfigWithFallbacks extends TranslationConfig {
  fallbacks: ConfigFallback[]
}

// ============================================================================
// Project Config & Budget
// ============================================================================

export interface ProjectConfig {
  projectId: string
  configId: string
  isDefault: boolean
  priority: number
  createdAt: string
}

export interface ProjectBudget {
  projectId: string
  budgetUsd: number
  spentUsd: number
  alertThreshold: number
  hardLimit: boolean
  createdAt: string
  updatedAt: string
}

// ============================================================================
// Cost Estimation
// ============================================================================

export interface CostEstimate {
  inputTokens: number
  outputTokens: number
  inputCostUsd: number
  outputCostUsd: number
  totalCostUsd: number
  configBreakdown: Array<{
    configId: string
    configName: string
    probability: number
    estimatedCostUsd: number
  }>
  warnings: string[]
}

// ============================================================================
// Chain Execution
// ============================================================================

export interface ChainExecutionStep {
  configId: string
  configName: string
  providerConfigId: string
  modelId: string
  attemptNumber: number
  durationMs: number
  costUsd: number
  error?: string
  errorType?: ErrorType
  retryCount: number
}

export interface ChainExecutionResult {
  success: boolean
  translatedText?: string
  tokensUsed: TokenUsage
  totalCostUsd: number
  executionPath: ChainExecutionStep[]
  finalConfigId?: string
  finalError?: string
  finalErrorType?: ErrorType
  source: 'live' | 'memory' | 'override'
  glossaryTermsUsed: number
}

// ============================================================================
// Translation Types
// ============================================================================

export interface TranslationRequest {
  chapterId: string
  sourceText: string
  config: TranslationConfig
  glossaryTerms?: GlossaryTerm[]
}

export interface TranslationResult {
  chapterId: string
  translatedText: string
  tokensUsed: TokenUsage
  provider: string
  model: string
  configId?: string
  executionPath?: ChainExecutionStep[]
}

export interface PreviewResult {
  success: boolean
  translatedText?: string
  originalText: string
  costUsd: number
  tokensUsed: { input: number; output: number }
  providerConfigId: string
  modelId: string
  error?: string
}

export interface TokenUsage {
  input: number
  output: number
  total: number
}

// ============================================================================
// Provider Types
// ============================================================================

export type ProviderType = 'builtin' | 'openai_compatible'

export type BuiltinProviderId =
  | 'openai'
  | 'anthropic'
  | 'gemini'
  | 'xai'
  | 'deepseek'
  | 'groq'
  | 'openrouter'
  | 'together'
  | 'ollama'

export interface ProviderConfig {
  id: string
  providerType: ProviderType
  builtinId?: BuiltinProviderId        // e.g., 'openai', 'anthropic' - for builtin types
  displayName: string
  baseUrl?: string                     // Required for openai_compatible, optional override for builtin
  customModels?: ModelInfo[]           // Custom/override model list
  isEnabled: boolean
  sortOrder: number
  settings: ProviderSettings
  createdAt: string
  updatedAt: string
}

export interface ProviderSettings {
  timeout?: number
  customHeaders?: Record<string, string>
  organizationId?: string
}

export interface BuiltinProviderTemplate {
  id: BuiltinProviderId
  name: string
  description: string
  defaultBaseUrl: string
  supportsBaseUrlOverride: boolean
  sdkType: 'openai' | 'anthropic' | 'gemini' | 'openai_compatible'
  defaultModels: ModelInfo[]
}

export interface ProviderInfo {
  id: string
  name: string
  models: ModelInfo[]
}

export interface ProviderInfoExtended extends ProviderInfo {
  configId: string
  providerType: ProviderType
  builtinId?: BuiltinProviderId
  baseUrl?: string
  isEnabled: boolean
  hasValidKey: boolean
  keyCount: number
  totalRequests: number
}

export interface ModelInfo {
  id: string
  name: string
  contextWindow: number
  inputPricePerMillion?: number
  outputPricePerMillion?: number
}

// ============================================================================
// Glossary Types (Extended)
// ============================================================================

export type TermType = 'name' | 'place' | 'skill' | 'item' | 'honorific' | 'other'
export type GlossaryGender = 'male' | 'female' | 'neutral' | 'unknown'

export interface GlossaryTerm {
  id: string
  projectId: string | null // null for global terms
  sourceTerm: string
  targetTerm: string
  termType: TermType
  gender?: GlossaryGender
  pronouns?: string
  aliases: string[]
  context?: string
  notes?: string
  autoGenerated: boolean
  confidence: number
  sourceContext?: string
  usageCount: number
  createdAt: string
  updatedAt: string
}

export interface GlossarySuggestion {
  id: string
  projectId: string
  chapterId?: string
  sourceTerm: string
  suggestedTarget: string
  termType: TermType
  gender?: GlossaryGender
  confidence: number
  sourceContext: string
  status: 'pending' | 'accepted' | 'rejected' | 'merged'
  reviewedAt?: string
  createdAt: string
}

export interface GlossaryRunResult {
  projectId: string
  totalChapters: number
  processedChapters: number
  totalSuggestions: number
  totalCostUsd: number
  totalTokens: number
  results: Array<{
    chapterId: string
    suggestionsCreated: number
    tokensUsed: number
    costUsd: number
    error?: string
  }>
  errors: string[]
}

export interface GlossaryRunProgressEvent {
  projectId: string
  current: number
  total: number
  chapterId: string
}

// ============================================================================
// Translation Memory & Overrides
// ============================================================================

export interface TranslationMemoryEntry {
  id: string
  sourceHash: string
  sourceText: string
  targetText: string
  providerConfigId: string
  modelId: string
  configId?: string
  confidence: number
  manuallyVerified: boolean
  usageCount: number
  projectId?: string
  lastUsedAt?: string
  createdAt: string
}

export interface TranslationOverride {
  id: string
  projectId: string
  chapterId?: string
  sourceSegment: string
  originalTranslation: string
  overrideTranslation: string
  scope: 'chapter' | 'project' | 'global'
  reason?: string
  createdAt: string
}

export interface TranslationVersion {
  id: string
  chapterId: string
  translatedText: string
  configId?: string
  configName?: string
  providerConfigId?: string
  modelId?: string
  versionNumber: number
  createdAt: string
}

// ============================================================================
// Prompt Templates
// ============================================================================

export type TemplateCategory = 'literal' | 'natural' | 'specialized' | 'custom'

export interface PromptTemplate {
  id: string
  name: string
  description?: string
  category: TemplateCategory
  systemPrompt: string
  userPromptTemplate: string
  suggestedTemperature: number
  suggestedMaxTokens?: number
  isBuiltIn: boolean
  usageCount: number
  createdAt: string
}

// ============================================================================
// API Keys (Multi-key)
// ============================================================================

export interface ApiKeyEntry {
  id: string
  providerConfigId: string
  label?: string
  isValid: boolean
  lastValidatedAt?: string
  lastErrorAt?: string
  lastError?: string
  requestCount: number
  lastUsedAt?: string
  priority: number
  isEnabled: boolean
  createdAt: string
}

export type KeyRotationStrategy = 'priority' | 'round_robin' | 'least_recently_used'

export interface KeyValidationResult {
  keyId: string
  providerConfigId: string
  label?: string
  isValid: boolean
  error?: string
}

// ============================================================================
// Testing Center
// ============================================================================

export type TestType = 'single' | 'comparison' | 'batch'

export interface TestRun {
  id: string
  name: string
  sampleText: string
  sourceLanguage: string
  targetLanguage: string
  testType: TestType
  createdAt: string
  results?: TestResult[]
  batchChapters?: string[] // For batch tests
}

export interface TestResult {
  id: string
  testRunId: string
  configId?: string
  configSnapshotId?: string
  configName: string
  providerConfigId: string
  modelId: string
  resultText?: string
  tokensIn: number
  tokensOut: number
  costUsd: number
  durationMs: number
  error?: string
  errorType?: ErrorType
  executionPath: ChainExecutionStep[]
  createdAt: string
}

// ============================================================================
// Config Import/Export
// ============================================================================

export interface ConfigExport {
  version: string
  exportedAt: string
  configs: Array<{
    name: string
    providerConfigId: string
    modelId: string
    systemPrompt: string
    userPromptTemplate: string
    temperature: number
    maxTokens?: number
    fallbacks: Array<{
      fallbackConfigName: string
      priority: number
      conditionType: FallbackConditionType
    }>
  }>
  templates?: PromptTemplate[]
  glossaryTerms?: GlossaryTerm[]
}

export interface ImportResult {
  configsImported: number
  configsSkipped: number
  templatesImported: number
  termsImported: number
  warnings: string[]
  errors: string[]
}

// ============================================================================
// Settings Types (Extended)
// ============================================================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface AppSettings {
  theme: 'light' | 'dark' | 'system'
  uiMode: UIMode
  defaultConfigId?: string
  defaultProviderId?: string
  defaultModelId?: string
  translationConcurrency: number
  autoSaveInterval: number
  keyRotationStrategy: KeyRotationStrategy
  globalRetryConfigId?: string
  enableTranslationMemory: boolean
  enableGlossaryInjection: boolean
  showCostEstimates: boolean
  // Debug/Logging settings
  logLevel: LogLevel
  enableFileLogging: boolean
}

// ============================================================================
// Usage Tracking Types
// ============================================================================

export interface UsageLog {
  id: string
  projectId: string
  chapterId?: string
  configId?: string
  provider: string
  model: string
  tokensIn: number
  tokensOut: number
  costUsd: number
  createdAt: string
}

// ============================================================================
// IPC Channel Types
// ============================================================================

export type IpcChannel =
  // Project channels
  | 'project:create'
  | 'project:open'
  | 'project:delete'
  | 'project:list'
  | 'project:get'
  | 'project:import-epub'
  // Chapter channels
  | 'chapter:list'
  | 'chapter:get'
  | 'chapter:get-content'
  | 'chapter:update-status'
  // Translation channels
  | 'translation:start'
  | 'translation:pause'
  | 'translation:resume'
  | 'translation:cancel'
  | 'translation:progress'
  | 'translation:chainFallback'
  // Config channels
  | 'config:list'
  | 'config:get'
  | 'config:save'
  | 'config:delete'
  | 'config:getFallbacks'
  | 'config:saveFallback'
  | 'config:deleteFallback'
  | 'config:getSnapshots'
  | 'config:import'
  | 'config:export'
  // Project config channels
  | 'projectConfig:get'
  | 'projectConfig:set'
  // Template channels
  | 'template:list'
  | 'template:get'
  | 'template:create'
  | 'template:delete'
  // Glossary channels
  | 'glossary:list'
  | 'glossary:get'
  | 'glossary:save'
  | 'glossary:delete'
  | 'glossary:getSuggestions'
  | 'glossary:acceptSuggestion'
  | 'glossary:rejectSuggestion'
  | 'glossary:runExtraction'
  // Translation memory channels
  | 'memory:list'
  | 'memory:get'
  | 'memory:delete'
  | 'memory:verify'
  | 'memory:stats'
  | 'memory:updateConfidence'
  // Override channels
  | 'override:list'
  | 'override:save'
  | 'override:create'
  | 'override:update'
  | 'override:delete'
  // Budget channels
  | 'budget:get'
  | 'budget:set'
  | 'budget:check'
  // Test channels
  | 'test:runSingle'
  | 'test:runComparison'
  | 'test:runBatch'
  | 'test:getHistory'
  | 'test:deleteRun'
  // Settings channels
  | 'settings:get'
  | 'settings:save'
  // API Key channels
  | 'apikey:list'
  | 'apikey:get'
  | 'apikey:save'
  | 'apikey:delete'
  | 'apikey:validate'
  | 'apikey:setRotationStrategy'
  // Provider Config channels
  | 'providerConfig:getTemplates'
  | 'providerConfig:list'
  | 'providerConfig:get'
  | 'providerConfig:create'
  | 'providerConfig:update'
  | 'providerConfig:delete'
  | 'providerConfig:getModels'
  | 'providerConfig:fetchModels'
  | 'providerConfig:validateConnection'
  // Retry config channels
  | 'retryConfig:get'
  | 'retryConfig:save'
  // Sidecar channels
  | 'sidecar:health'
  | 'sidecar:parse-epub'
  | 'sidecar:export-epub'

// ============================================================================
// Event Types (for IPC events from main to renderer)
// ============================================================================

export interface TranslationProgressEvent {
  projectId: string
  chapterId: string
  status: ChapterStatus
  progress: number // 0-100
  message?: string
  configId?: string
  executionPath?: ChainExecutionStep[]
}

export interface ChainFallbackEvent {
  fromConfigId: string
  toConfigId: string
  errorType: ErrorType
  error: string
}

export interface GlossaryExtractionProgressEvent {
  projectId: string
  chaptersProcessed: number
  totalChapters: number
  termsFound: number
  status: 'running' | 'completed' | 'error'
  error?: string
}

export interface SidecarStatusEvent {
  connected: boolean
  error?: string
}
