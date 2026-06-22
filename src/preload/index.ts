import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type {
  Project,
  Chapter,
  ChapterContent,
  TranslationConfig,
  ConfigFallback,
  ConfigSnapshot,
  ConfigWithFallbacks,
  ProjectConfig,
  PromptTemplate,
  AppSettings,
  ProviderInfo,
  ProviderInfoExtended,
  ProviderConfig,
  BuiltinProviderTemplate,
  BuiltinProviderId,
  ModelInfo,
  ProviderSettings,
  TestRun,
  CostEstimate,
  GlossaryTerm,
  GlossarySuggestion,
  GlossaryRunResult,
  GlossaryRunProgressEvent,
  TranslationMemoryEntry,
  TranslationOverride,
  ApiKeyEntry,
  ProjectBudget,
  TranslationProgressEvent,
  SidecarStatusEvent,
  ChainFallbackEvent,
  FallbackConditionType,
  ConfigExport,
  ImportResult,
  KeyValidationResult,
  PreviewResult,
  TranslationVersion
} from '../shared/types'

// Type-safe IPC invoke wrapper
function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  return ipcRenderer.invoke(channel, ...args)
}

// Custom APIs for renderer - type-safe interface to main process
const api = {
  // =========================================================================
  // Project APIs
  // =========================================================================
  project: {
    create: (name: string, epubPath: string) => invoke<Project>('project:create', name, epubPath),
    open: (id: string) => invoke<Project>('project:open', id),
    delete: (id: string) => invoke<void>('project:delete', id),
    list: () => invoke<Project[]>('project:list'),
    get: (id: string) => invoke<Project | null>('project:get', id),
    importEpub: (filePath?: string) => invoke<Project | null>('project:import-epub', filePath)
  },

  // =========================================================================
  // Chapter APIs
  // =========================================================================
  chapter: {
    list: (projectId: string) => invoke<Chapter[]>('chapter:list', projectId),
    get: (id: string) => invoke<Chapter | null>('chapter:get', id),
    getContent: (id: string) => invoke<ChapterContent | null>('chapter:get-content', id),
    updateStatus: (id: string, status: string) => invoke<void>('chapter:update-status', id, status),
    clearTranslations: (chapterIds: string[]) => invoke<number>('chapter:clear-translations', chapterIds),
    listVersions: (chapterId: string) => invoke<TranslationVersion[]>('chapter:list-versions', chapterId),
    getVersion: (versionId: string) => invoke<TranslationVersion | null>('chapter:get-version', versionId),
    restoreVersion: (versionId: string) => invoke<boolean>('chapter:restore-version', versionId)
  },

  // =========================================================================
  // Translation APIs
  // =========================================================================
  translation: {
    start: (projectId: string, chapterIds: string[], configId?: string) =>
      invoke<void>('translation:start', projectId, chapterIds, configId),
    pause: (projectId: string) => invoke<void>('translation:pause', projectId),
    resume: (projectId: string) => invoke<void>('translation:resume', projectId),
    cancel: (projectId: string) => invoke<void>('translation:cancel', projectId),
    preview: (text: string, configId: string, sourceLanguage: string, targetLanguage: string) =>
      invoke<PreviewResult>('translation:preview', text, configId, sourceLanguage, targetLanguage)
  },

  // =========================================================================
  // Config APIs (Extended)
  // =========================================================================
  config: {
    list: () => invoke<TranslationConfig[]>('config:list'),
    get: (id: string) => invoke<TranslationConfig | null>('config:get', id),
    getWithFallbacks: (id: string) => invoke<ConfigWithFallbacks | null>('config:getWithFallbacks', id),
    save: (config: TranslationConfig) => invoke<TranslationConfig>('config:save', config),
    delete: (id: string) => invoke<void>('config:delete', id),
    getDefault: () => invoke<TranslationConfig | null>('config:getDefault'),
    setDefault: (id: string) => invoke<void>('config:setDefault', id),

    // Fallbacks
    getFallbacks: (configId: string) => invoke<ConfigFallback[]>('config:getFallbacks', configId),
    createFallback: (
      configId: string,
      fallbackConfigId: string,
      priority: number,
      conditionType: FallbackConditionType,
      conditionValue?: string
    ) =>
      invoke<ConfigFallback>(
        'config:createFallback',
        configId,
        fallbackConfigId,
        priority,
        conditionType,
        conditionValue
      ),
    updateFallback: (id: string, updates: Partial<ConfigFallback>) =>
      invoke<void>('config:updateFallback', id, updates),
    deleteFallback: (id: string) => invoke<void>('config:deleteFallback', id),
    wouldCreateCycle: (sourceConfigId: string, targetConfigId: string) =>
      invoke<boolean>('config:wouldCreateCycle', sourceConfigId, targetConfigId),

    // Snapshots
    getSnapshots: (configId: string) => invoke<ConfigSnapshot[]>('config:getSnapshots', configId),
    getSnapshot: (id: string) => invoke<ConfigSnapshot | null>('config:getSnapshot', id),
    createSnapshot: (configId: string, reason: 'edit' | 'test' | 'translation') =>
      invoke<ConfigSnapshot>('config:createSnapshot', configId, reason),
    restoreSnapshot: (snapshotId: string) => invoke<void>('config:restoreSnapshot', snapshotId),

    // Import/Export
    export: (configIds: string[]) => invoke<ConfigExport>('config:export', configIds),
    import: (data: ConfigExport) => invoke<ImportResult>('config:import', data)
  },

  // =========================================================================
  // Project Config APIs
  // =========================================================================
  projectConfig: {
    list: (projectId: string) => invoke<ProjectConfig[]>('projectConfig:list', projectId),
    getDefault: (projectId: string) =>
      invoke<TranslationConfig | null>('projectConfig:getDefault', projectId),
    assign: (projectId: string, configId: string, isDefault: boolean, priority: number) =>
      invoke<ProjectConfig>('projectConfig:assign', projectId, configId, isDefault, priority),
    remove: (projectId: string, configId: string) =>
      invoke<void>('projectConfig:remove', projectId, configId)
  },

  // =========================================================================
  // Template APIs
  // =========================================================================
  template: {
    list: () => invoke<PromptTemplate[]>('template:list'),
    get: (id: string) => invoke<PromptTemplate | null>('template:get', id),
    create: (template: Omit<PromptTemplate, 'id' | 'isBuiltIn' | 'usageCount' | 'createdAt'>) =>
      invoke<PromptTemplate>('template:create', template),
    update: (
      id: string,
      updates: Partial<Omit<PromptTemplate, 'id' | 'isBuiltIn' | 'usageCount' | 'createdAt'>>
    ) => invoke<void>('template:update', id, updates),
    delete: (id: string) => invoke<void>('template:delete', id),
    clone: (id: string, newName: string) => invoke<PromptTemplate>('template:clone', id, newName),
    use: (templateId: string, configName: string) =>
      invoke<TranslationConfig>('template:use', templateId, configName)
  },

  // =========================================================================
  // Test APIs (Testing Center)
  // =========================================================================
  test: {
    list: (limit?: number) => invoke<TestRun[]>('test:list', limit),
    get: (id: string) => invoke<TestRun | null>('test:get', id),
    getWithResults: (id: string) => invoke<TestRun | null>('test:getWithResults', id),
    delete: (id: string) => invoke<void>('test:delete', id),
    getConfigStats: (configId: string) =>
      invoke<{
        totalTests: number
        successRate: number
        avgDurationMs: number
        avgCostUsd: number
      }>('test:getConfigStats', configId),

    // Test execution
    runSingle: (
      name: string,
      sampleText: string,
      configId: string,
      sourceLanguage: string,
      targetLanguage: string
    ) => invoke<TestRun>('test:runSingle', name, sampleText, configId, sourceLanguage, targetLanguage),
    runComparison: (
      name: string,
      sampleText: string,
      configIds: string[],
      sourceLanguage: string,
      targetLanguage: string
    ) =>
      invoke<TestRun>(
        'test:runComparison',
        name,
        sampleText,
        configIds,
        sourceLanguage,
        targetLanguage
      ),
    runBatch: (
      name: string,
      chapterTexts: Array<{ chapterId: string; text: string }>,
      configId: string,
      sourceLanguage: string,
      targetLanguage: string
    ) =>
      invoke<TestRun>(
        'test:runBatch',
        name,
        chapterTexts,
        configId,
        sourceLanguage,
        targetLanguage
      ),

    // Cost estimation
    estimateCost: (text: string, configId: string) =>
      invoke<CostEstimate>('test:estimateCost', text, configId),
    estimateSingleCost: (text: string, configId: string) =>
      invoke<{ inputTokens: number; outputTokens: number; costUsd: number; formatted: string }>(
        'test:estimateSingleCost',
        text,
        configId
      )
  },

  // =========================================================================
  // Glossary APIs
  // =========================================================================
  glossary: {
    list: (projectId: string | null) => invoke<GlossaryTerm[]>('glossary:list', projectId),
    get: (id: string) => invoke<GlossaryTerm | null>('glossary:get', id),
    search: (query: string, projectId?: string, termType?: string) =>
      invoke<GlossaryTerm[]>('glossary:search', query, projectId, termType),
    findBySource: (sourceTerm: string, projectId?: string) =>
      invoke<GlossaryTerm | null>('glossary:findBySource', sourceTerm, projectId),
    create: (term: Omit<GlossaryTerm, 'id' | 'usageCount' | 'createdAt' | 'updatedAt'>) =>
      invoke<GlossaryTerm>('glossary:create', term),
    update: (
      id: string,
      updates: Partial<Omit<GlossaryTerm, 'id' | 'usageCount' | 'createdAt' | 'updatedAt'>>
    ) => invoke<void>('glossary:update', id, updates),
    delete: (id: string) => invoke<void>('glossary:delete', id),

    // Suggestions
    getPendingSuggestions: (projectId: string) =>
      invoke<GlossarySuggestion[]>('glossary:getPendingSuggestions', projectId),
    getSuggestion: (id: string) => invoke<GlossarySuggestion | null>('glossary:getSuggestion', id),
    acceptSuggestion: (id: string) => invoke<GlossaryTerm>('glossary:acceptSuggestion', id),
    rejectSuggestion: (id: string) => invoke<void>('glossary:rejectSuggestion', id),
    mergeSuggestion: (suggestionId: string, existingTermId: string) =>
      invoke<void>('glossary:mergeSuggestion', suggestionId, existingTermId),

    // Import/Export
    import: (
      terms: Array<Omit<GlossaryTerm, 'id' | 'usageCount' | 'createdAt' | 'updatedAt'>>,
      skipDuplicates?: boolean
    ) => invoke<{ imported: number; skipped: number }>('glossary:import', terms, skipDuplicates),
    export: (projectId?: string) => invoke<GlossaryTerm[]>('glossary:export', projectId),
    importCSV: (csvData: string, projectId: string | null, skipDuplicates?: boolean) =>
      invoke<{ imported: number; skipped: number; errors: string[] }>(
        'glossary:importCSV',
        csvData,
        projectId,
        skipDuplicates
      )
  },

  // =========================================================================
  // Glossary Run APIs
  // =========================================================================
  glossaryRun: {
    getRecommendedModels: () =>
      invoke<Array<{ providerConfigId: string; modelId: string; displayName: string }>>('glossaryRun:getRecommendedModels'),
    estimateCost: (
      projectId: string,
      chapterIds: string[],
      providerConfigId: string,
      modelId: string
    ) => invoke<CostEstimate>('glossaryRun:estimate', projectId, chapterIds, providerConfigId, modelId),
    run: (
      projectId: string,
      chapterIds: string[],
      providerConfigId: string,
      modelId: string,
      concurrency?: number
    ) =>
      invoke<GlossaryRunResult>(
        'glossaryRun:run',
        projectId,
        chapterIds,
        providerConfigId,
        modelId,
        concurrency
      )
  },

  // =========================================================================
  // Translation Memory APIs
  // =========================================================================
  memory: {
    list: (projectId?: string, limit?: number, offset?: number) =>
      invoke<TranslationMemoryEntry[]>('memory:list', projectId, limit, offset),
    stats: (projectId?: string) =>
      invoke<{ totalEntries: number; verifiedEntries: number; totalUsageCount: number }>(
        'memory:stats',
        projectId
      ),
    verify: (id: string) => invoke<void>('memory:verify', id),
    updateConfidence: (id: string, confidence: number) =>
      invoke<void>('memory:updateConfidence', id, confidence),
    delete: (id: string) => invoke<void>('memory:delete', id)
  },

  override: {
    list: (projectId: string, chapterId?: string) =>
      invoke<TranslationOverride[]>('override:list', projectId, chapterId),
    create: (override: Omit<TranslationOverride, 'id' | 'createdAt'>) =>
      invoke<TranslationOverride>('override:create', override),
    update: (
      id: string,
      updates: Partial<Omit<TranslationOverride, 'id' | 'projectId' | 'createdAt'>>
    ) => invoke<void>('override:update', id, updates),
    delete: (id: string) => invoke<void>('override:delete', id)
  },

  // =========================================================================
  // Settings APIs
  // =========================================================================
  settings: {
    get: () => invoke<AppSettings>('settings:get'),
    save: (settings: Partial<AppSettings>) => invoke<AppSettings>('settings:save', settings),
    export: () => invoke<{ success: boolean; filePath?: string; error?: string }>('settings:export'),
    import: () => invoke<{ success: boolean; imported?: { settings: boolean; glossaryTerms: number }; error?: string }>('settings:import')
  },

  // =========================================================================
  // API Key APIs (Extended)
  // =========================================================================
  apiKey: {
    list: (providerConfigId?: string) => invoke<ApiKeyEntry[]>('apikey:list', providerConfigId),
    get: (keyId: string) => invoke<ApiKeyEntry | null>('apikey:get', keyId),
    getForProvider: (providerConfigId: string) => invoke<string | null>('apikey:getForProvider', providerConfigId),
    hasValidKeys: (providerConfigId: string) => invoke<boolean>('apikey:hasValidKeys', providerConfigId),
    save: (providerConfigId: string, keyValue: string, label?: string, priority?: number) =>
      invoke<ApiKeyEntry>('apikey:save', providerConfigId, keyValue, label, priority),
    updateValue: (keyId: string, newKeyValue: string) =>
      invoke<void>('apikey:updateValue', keyId, newKeyValue),
    updateMeta: (
      keyId: string,
      updates: Partial<{ label: string | null; priority: number; isEnabled: boolean }>
    ) => invoke<void>('apikey:updateMeta', keyId, updates),
    delete: (keyId: string) => invoke<void>('apikey:delete', keyId),
    validate: (providerConfigId: string, keyValue: string) =>
      invoke<boolean>('apikey:validate', providerConfigId, keyValue),
    validateStored: (keyId: string) => invoke<boolean>('apikey:validateStored', keyId),
    validateAll: () => invoke<KeyValidationResult[]>('apikey:validateAll'),
    setRotationStrategy: (strategy: 'priority' | 'round_robin' | 'least_recently_used') =>
      invoke<void>('apikey:setRotationStrategy', strategy),
    getRotationStrategy: () => invoke<'priority' | 'round_robin' | 'least_recently_used'>(
      'apikey:getRotationStrategy'
    )
  },

  // =========================================================================
  // Budget APIs
  // =========================================================================
  budget: {
    get: (projectId: string) => invoke<ProjectBudget | null>('budget:get', projectId),
    set: (projectId: string, budgetUsd: number, alertThreshold?: number, hardLimit?: boolean) =>
      invoke<ProjectBudget>('budget:set', projectId, budgetUsd, alertThreshold, hardLimit),
    check: (projectId: string, estimatedCostUsd: number) =>
      invoke<{ allowed: boolean; warning?: string; remaining?: number }>(
        'budget:check',
        projectId,
        estimatedCostUsd
      ),
    recordSpending: (projectId: string, amountUsd: number) =>
      invoke<void>('budget:recordSpending', projectId, amountUsd),
    resetSpending: (projectId: string) => invoke<void>('budget:resetSpending', projectId),
    list: () => invoke<ProjectBudget[]>('budget:list')
  },

  // =========================================================================
  // Provider APIs (Legacy)
  // =========================================================================
  provider: {
    list: () => invoke<ProviderInfo[]>('provider:list')
  },

  // =========================================================================
  // Provider Config APIs (New)
  // =========================================================================
  providerConfig: {
    // Get builtin provider templates
    getTemplates: () => invoke<BuiltinProviderTemplate[]>('providerConfig:getTemplates'),

    // List all configured providers with extended info
    list: () => invoke<ProviderInfoExtended[]>('providerConfig:list'),

    // Get a specific provider config
    get: (configId: string) => invoke<ProviderConfig | null>('providerConfig:get', configId),

    // Create a new provider config
    create: (params: {
      builtinId?: BuiltinProviderId
      displayName: string
      baseUrl?: string
      customModels?: ModelInfo[]
      settings?: ProviderSettings
    }) => invoke<ProviderConfig>('providerConfig:create', params),

    // Update a provider config
    update: (
      configId: string,
      updates: Partial<Omit<ProviderConfig, 'id' | 'createdAt' | 'updatedAt'>>
    ) => invoke<void>('providerConfig:update', configId, updates),

    // Delete a provider config
    delete: (configId: string) => invoke<void>('providerConfig:delete', configId),

    // Get models for a provider config
    getModels: (configId: string) => invoke<ModelInfo[]>('providerConfig:getModels', configId),

    // Fetch models from provider API
    fetchModels: (configId: string, apiKey: string) =>
      invoke<ModelInfo[]>('providerConfig:fetchModels', configId, apiKey),

    // Validate connection to a provider
    validateConnection: (configId: string, apiKey: string) =>
      invoke<{ valid: boolean; error?: string; models?: number }>(
        'providerConfig:validateConnection',
        configId,
        apiKey
      ),

    // Check if a builtin provider is already configured
    isBuiltinConfigured: (builtinId: BuiltinProviderId) =>
      invoke<boolean>('providerConfig:isBuiltinConfigured', builtinId)
  },

  // =========================================================================
  // Sidecar APIs
  // =========================================================================
  sidecar: {
    health: () => invoke<boolean>('sidecar:health')
  },

  // =========================================================================
  // Event Subscriptions
  // =========================================================================
  on: {
    translationProgress: (callback: (event: TranslationProgressEvent) => void) => {
      const handler = (_: unknown, data: TranslationProgressEvent) => callback(data)
      ipcRenderer.on('translation:progress', handler)
      return () => ipcRenderer.removeListener('translation:progress', handler)
    },
    chainFallback: (callback: (event: ChainFallbackEvent) => void) => {
      const handler = (_: unknown, data: ChainFallbackEvent) => callback(data)
      ipcRenderer.on('translation:chainFallback', handler)
      return () => ipcRenderer.removeListener('translation:chainFallback', handler)
    },
    sidecarStatus: (callback: (event: SidecarStatusEvent) => void) => {
      const handler = (_: unknown, data: SidecarStatusEvent) => callback(data)
      ipcRenderer.on('sidecar:status', handler)
      return () => ipcRenderer.removeListener('sidecar:status', handler)
    },
    testBatchProgress: (
      callback: (event: { testRunId: string; current: number; total: number; chapterId: string }) => void
    ) => {
      const handler = (
        _: unknown,
        data: { testRunId: string; current: number; total: number; chapterId: string }
      ) => callback(data)
      ipcRenderer.on('test:batchProgress', handler)
      return () => ipcRenderer.removeListener('test:batchProgress', handler)
    },
    glossaryRunProgress: (callback: (event: GlossaryRunProgressEvent) => void) => {
      const handler = (_: unknown, data: GlossaryRunProgressEvent) => callback(data)
      ipcRenderer.on('glossary:runProgress', handler)
      return () => ipcRenderer.removeListener('glossary:runProgress', handler)
    }
  },

  // =========================================================================
  // Utility APIs
  // =========================================================================
  ping: () => invoke<string>('ping')
}

// Export type for use in renderer
export type Api = typeof api

// Use `contextBridge` APIs to expose Electron APIs to renderer
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
    console.log('[Preload] API exposed to renderer')
  } catch (error) {
    console.error('[Preload] Failed to expose API:', error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
  console.log('[Preload] API attached to window (non-isolated)')
}
