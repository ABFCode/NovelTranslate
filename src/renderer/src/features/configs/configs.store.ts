import { create } from 'zustand'
import type {
  TranslationConfig,
  ConfigFallback,
  ConfigSnapshot,
  PromptTemplate,
  ConfigWithFallbacks,
  FallbackConditionType
} from '../../../../shared/types'

interface ConfigsState {
  // Data
  configs: TranslationConfig[]
  templates: PromptTemplate[]
  selectedConfigId: string | null
  selectedConfig: ConfigWithFallbacks | null

  // Loading states
  isLoading: boolean
  isLoadingTemplates: boolean
  isSaving: boolean

  // Actions
  fetchConfigs: () => Promise<void>
  fetchTemplates: () => Promise<void>
  selectConfig: (id: string | null) => Promise<void>
  createConfig: (config: Omit<TranslationConfig, 'id' | 'createdAt' | 'updatedAt'>) => Promise<TranslationConfig>
  updateConfig: (id: string, updates: Partial<TranslationConfig>) => Promise<void>
  deleteConfig: (id: string) => Promise<void>
  setDefaultConfig: (id: string) => Promise<void>

  // Fallback actions
  addFallback: (
    configId: string,
    fallbackConfigId: string,
    priority: number,
    conditionType: FallbackConditionType
  ) => Promise<ConfigFallback>
  updateFallback: (id: string, updates: Partial<ConfigFallback>) => Promise<void>
  deleteFallback: (id: string) => Promise<void>

  // Snapshot actions
  fetchSnapshots: (configId: string) => Promise<ConfigSnapshot[]>
  restoreSnapshot: (snapshotId: string) => Promise<void>

  // Template actions
  createFromTemplate: (templateId: string, name: string) => Promise<TranslationConfig>
}

export const useConfigsStore = create<ConfigsState>((set, get) => ({
  configs: [],
  templates: [],
  selectedConfigId: null,
  selectedConfig: null,
  isLoading: false,
  isLoadingTemplates: false,
  isSaving: false,

  fetchConfigs: async () => {
    set({ isLoading: true })
    try {
      const configs = await window.api.config.list()
      set({ configs, isLoading: false })
    } catch (error) {
      console.error('Failed to fetch configs:', error)
      set({ isLoading: false })
    }
  },

  fetchTemplates: async () => {
    set({ isLoadingTemplates: true })
    try {
      const templates = await window.api.template.list()
      set({ templates, isLoadingTemplates: false })
    } catch (error) {
      console.error('Failed to fetch templates:', error)
      set({ isLoadingTemplates: false })
    }
  },

  selectConfig: async (id) => {
    if (!id) {
      set({ selectedConfigId: null, selectedConfig: null })
      return
    }

    try {
      const config = await window.api.config.getWithFallbacks(id)
      set({ selectedConfigId: id, selectedConfig: config })
    } catch (error) {
      console.error('Failed to fetch config:', error)
    }
  },

  createConfig: async (config) => {
    set({ isSaving: true })
    try {
      const newConfig = await window.api.config.save(config as TranslationConfig)
      await get().fetchConfigs()
      set({ isSaving: false })
      return newConfig
    } catch (error) {
      set({ isSaving: false })
      throw error
    }
  },

  updateConfig: async (id, updates) => {
    set({ isSaving: true })
    try {
      const existing = get().configs.find((c) => c.id === id)
      if (!existing) throw new Error('Config not found')

      await window.api.config.save({ ...existing, ...updates })
      await get().fetchConfigs()

      // Refresh selected config if it's the one being updated
      if (get().selectedConfigId === id) {
        await get().selectConfig(id)
      }

      set({ isSaving: false })
    } catch (error) {
      set({ isSaving: false })
      throw error
    }
  },

  deleteConfig: async (id) => {
    try {
      await window.api.config.delete(id)
      await get().fetchConfigs()

      if (get().selectedConfigId === id) {
        set({ selectedConfigId: null, selectedConfig: null })
      }
    } catch (error) {
      console.error('Failed to delete config:', error)
      throw error
    }
  },

  setDefaultConfig: async (id) => {
    try {
      await window.api.config.setDefault(id)
      await get().fetchConfigs()
    } catch (error) {
      console.error('Failed to set default config:', error)
      throw error
    }
  },

  addFallback: async (configId, fallbackConfigId, priority, conditionType) => {
    try {
      const fallback = await window.api.config.createFallback(
        configId,
        fallbackConfigId,
        priority,
        conditionType
      )

      // Refresh selected config
      if (get().selectedConfigId === configId) {
        await get().selectConfig(configId)
      }

      return fallback
    } catch (error) {
      console.error('Failed to add fallback:', error)
      throw error
    }
  },

  updateFallback: async (id, updates) => {
    try {
      await window.api.config.updateFallback(id, updates)

      // Refresh selected config
      const selectedId = get().selectedConfigId
      if (selectedId) {
        await get().selectConfig(selectedId)
      }
    } catch (error) {
      console.error('Failed to update fallback:', error)
      throw error
    }
  },

  deleteFallback: async (id) => {
    try {
      await window.api.config.deleteFallback(id)

      // Refresh selected config
      const selectedId = get().selectedConfigId
      if (selectedId) {
        await get().selectConfig(selectedId)
      }
    } catch (error) {
      console.error('Failed to delete fallback:', error)
      throw error
    }
  },

  fetchSnapshots: async (configId) => {
    try {
      return await window.api.config.getSnapshots(configId)
    } catch (error) {
      console.error('Failed to fetch snapshots:', error)
      return []
    }
  },

  restoreSnapshot: async (snapshotId) => {
    try {
      await window.api.config.restoreSnapshot(snapshotId)
      await get().fetchConfigs()

      // Refresh selected config
      const selectedId = get().selectedConfigId
      if (selectedId) {
        await get().selectConfig(selectedId)
      }
    } catch (error) {
      console.error('Failed to restore snapshot:', error)
      throw error
    }
  },

  createFromTemplate: async (templateId, name) => {
    try {
      const config = await window.api.template.use(templateId, name)
      await get().fetchConfigs()
      return config
    } catch (error) {
      console.error('Failed to create from template:', error)
      throw error
    }
  }
}))
