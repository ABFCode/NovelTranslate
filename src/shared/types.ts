// Shared types between main and renderer processes

// ============================================================================
// Project Types
// ============================================================================

export interface Project {
  id: string
  name: string
  sourcePath: string
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
// Translation Types
// ============================================================================

export interface TranslationConfig {
  id: string
  name: string
  providerId: string
  modelId: string
  systemPrompt: string
  userPromptTemplate: string
  temperature: number
  maxTokens?: number
  fallbackConfigIds: string[]
}

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
}

export interface TokenUsage {
  input: number
  output: number
  total: number
}

// ============================================================================
// Provider Types
// ============================================================================

export interface ProviderInfo {
  id: string
  name: string
  models: ModelInfo[]
}

export interface ModelInfo {
  id: string
  name: string
  contextWindow: number
  inputPricePerMillion?: number
  outputPricePerMillion?: number
}

// ============================================================================
// Glossary Types
// ============================================================================

export type TermType = 'name' | 'place' | 'skill' | 'item' | 'other'

export interface GlossaryTerm {
  id: string
  projectId: string | null // null for global terms
  sourceTerm: string
  targetTerm: string
  termType: TermType
  context?: string
  notes?: string
}

// ============================================================================
// Settings Types
// ============================================================================

export interface AppSettings {
  theme: 'light' | 'dark' | 'system'
  defaultProviderId?: string
  defaultModelId?: string
  translationConcurrency: number
  autoSaveInterval: number
}

// ============================================================================
// Usage Tracking Types
// ============================================================================

export interface UsageLog {
  id: string
  projectId: string
  chapterId: string
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
  // Config channels
  | 'config:list'
  | 'config:get'
  | 'config:save'
  | 'config:delete'
  // Settings channels
  | 'settings:get'
  | 'settings:save'
  // API Key channels
  | 'apikey:get'
  | 'apikey:save'
  | 'apikey:delete'
  | 'apikey:validate'
  // Provider channels
  | 'provider:list'
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
}

export interface SidecarStatusEvent {
  connected: boolean
  error?: string
}
