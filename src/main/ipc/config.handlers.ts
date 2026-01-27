import { ipcMain } from 'electron'
import {
  getConfig,
  getConfigWithFallbacks,
  listConfigs,
  createConfig,
  updateConfig,
  deleteConfig,
  getDefaultConfig,
  setDefaultConfig,
  getFallbacksForConfig,
  createFallback,
  updateFallback,
  deleteFallback,
  getSnapshotsForConfig,
  getSnapshot,
  restoreFromSnapshot,
  createConfigSnapshot,
  getProjectConfigs,
  getProjectDefaultConfig,
  assignConfigToProject,
  removeConfigFromProject,
  wouldCreateCycle
} from '../database'
import {
  listTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  cloneTemplate,
  incrementTemplateUsage
} from '../database/repositories/template.repository'
import type {
  TranslationConfig,
  ConfigFallback,
  ConfigSnapshot,
  ConfigWithFallbacks,
  ProjectConfig,
  FallbackConditionType,
  PromptTemplate,
  ConfigExport,
  ImportResult
} from '../../shared/types'

/**
 * Register config-related IPC handlers
 */
export function registerConfigHandlers(): void {
  // ============================================================================
  // Config CRUD
  // ============================================================================

  // List all configs
  ipcMain.handle('config:list', async (): Promise<TranslationConfig[]> => {
    return listConfigs()
  })

  // Get a config by ID
  ipcMain.handle('config:get', async (_event, id: string): Promise<TranslationConfig | null> => {
    return getConfig(id)
  })

  // Get a config with its fallbacks
  ipcMain.handle(
    'config:getWithFallbacks',
    async (_event, id: string): Promise<ConfigWithFallbacks | null> => {
      return getConfigWithFallbacks(id)
    }
  )

  // Save a config (create or update)
  ipcMain.handle(
    'config:save',
    async (_event, config: TranslationConfig): Promise<TranslationConfig> => {
      const existing = getConfig(config.id)

      if (existing) {
        updateConfig(config.id, config)
        return { ...existing, ...config }
      } else {
        return createConfig(config)
      }
    }
  )

  // Delete a config
  ipcMain.handle('config:delete', async (_event, id: string): Promise<void> => {
    deleteConfig(id)
  })

  // Get/set default config
  ipcMain.handle('config:getDefault', async (): Promise<TranslationConfig | null> => {
    return getDefaultConfig()
  })

  ipcMain.handle('config:setDefault', async (_event, id: string): Promise<void> => {
    setDefaultConfig(id)
  })

  // ============================================================================
  // Fallback Chain Management
  // ============================================================================

  // Get fallbacks for a config
  ipcMain.handle('config:getFallbacks', async (_event, configId: string): Promise<ConfigFallback[]> => {
    return getFallbacksForConfig(configId)
  })

  // Create a fallback
  ipcMain.handle(
    'config:createFallback',
    async (
      _event,
      configId: string,
      fallbackConfigId: string,
      priority: number,
      conditionType: FallbackConditionType,
      conditionValue?: string
    ): Promise<ConfigFallback> => {
      return createFallback(configId, fallbackConfigId, priority, conditionType, conditionValue)
    }
  )

  // Update a fallback
  ipcMain.handle(
    'config:updateFallback',
    async (
      _event,
      id: string,
      updates: Partial<Omit<ConfigFallback, 'id' | 'configId' | 'createdAt'>>
    ): Promise<void> => {
      updateFallback(id, updates)
    }
  )

  // Delete a fallback
  ipcMain.handle('config:deleteFallback', async (_event, id: string): Promise<void> => {
    deleteFallback(id)
  })

  // Check if fallback would create a cycle
  ipcMain.handle(
    'config:wouldCreateCycle',
    async (_event, sourceConfigId: string, targetConfigId: string): Promise<boolean> => {
      return wouldCreateCycle(sourceConfigId, targetConfigId)
    }
  )

  // ============================================================================
  // Snapshots (Versioning)
  // ============================================================================

  // Get snapshots for a config
  ipcMain.handle(
    'config:getSnapshots',
    async (_event, configId: string): Promise<ConfigSnapshot[]> => {
      return getSnapshotsForConfig(configId)
    }
  )

  // Get a specific snapshot
  ipcMain.handle('config:getSnapshot', async (_event, id: string): Promise<ConfigSnapshot | null> => {
    return getSnapshot(id)
  })

  // Create a snapshot manually
  ipcMain.handle(
    'config:createSnapshot',
    async (_event, configId: string, reason: 'edit' | 'test' | 'translation'): Promise<ConfigSnapshot> => {
      return createConfigSnapshot(configId, reason)
    }
  )

  // Restore from a snapshot
  ipcMain.handle('config:restoreSnapshot', async (_event, snapshotId: string): Promise<void> => {
    restoreFromSnapshot(snapshotId)
  })

  // ============================================================================
  // Project Configs
  // ============================================================================

  // Get configs assigned to a project
  ipcMain.handle(
    'projectConfig:list',
    async (_event, projectId: string): Promise<ProjectConfig[]> => {
      return getProjectConfigs(projectId)
    }
  )

  // Get the default config for a project
  ipcMain.handle(
    'projectConfig:getDefault',
    async (_event, projectId: string): Promise<TranslationConfig | null> => {
      return getProjectDefaultConfig(projectId)
    }
  )

  // Assign a config to a project
  ipcMain.handle(
    'projectConfig:assign',
    async (
      _event,
      projectId: string,
      configId: string,
      isDefault: boolean,
      priority: number
    ): Promise<ProjectConfig> => {
      return assignConfigToProject(projectId, configId, isDefault, priority)
    }
  )

  // Remove a config from a project
  ipcMain.handle(
    'projectConfig:remove',
    async (_event, projectId: string, configId: string): Promise<void> => {
      removeConfigFromProject(projectId, configId)
    }
  )

  // ============================================================================
  // Templates
  // ============================================================================

  // List all templates
  ipcMain.handle('template:list', async (): Promise<PromptTemplate[]> => {
    return listTemplates()
  })

  // Get a template
  ipcMain.handle('template:get', async (_event, id: string): Promise<PromptTemplate | null> => {
    return getTemplate(id)
  })

  // Create a template
  ipcMain.handle(
    'template:create',
    async (
      _event,
      template: Omit<PromptTemplate, 'id' | 'isBuiltIn' | 'usageCount' | 'createdAt'>
    ): Promise<PromptTemplate> => {
      return createTemplate(template)
    }
  )

  // Update a template
  ipcMain.handle(
    'template:update',
    async (
      _event,
      id: string,
      updates: Partial<Omit<PromptTemplate, 'id' | 'isBuiltIn' | 'usageCount' | 'createdAt'>>
    ): Promise<void> => {
      updateTemplate(id, updates)
    }
  )

  // Delete a template
  ipcMain.handle('template:delete', async (_event, id: string): Promise<void> => {
    deleteTemplate(id)
  })

  // Clone a template
  ipcMain.handle(
    'template:clone',
    async (_event, id: string, newName: string): Promise<PromptTemplate> => {
      return cloneTemplate(id, newName)
    }
  )

  // Use a template (increment usage and create config)
  ipcMain.handle(
    'template:use',
    async (_event, templateId: string, configName: string): Promise<TranslationConfig> => {
      const template = getTemplate(templateId)
      if (!template) {
        throw new Error(`Template not found: ${templateId}`)
      }

      incrementTemplateUsage(templateId)

      // Create a config from the template
      return createConfig({
        name: configName,
        providerId: 'openai', // Default provider
        modelId: 'gpt-4o-mini', // Default model
        systemPrompt: template.systemPrompt,
        userPromptTemplate: template.userPromptTemplate,
        temperature: template.suggestedTemperature,
        maxTokens: template.suggestedMaxTokens
      })
    }
  )

  // ============================================================================
  // Import/Export
  // ============================================================================

  // Export configs
  ipcMain.handle('config:export', async (_event, configIds: string[]): Promise<ConfigExport> => {
    const configs = configIds.map((id) => getConfigWithFallbacks(id)).filter(Boolean)

    return {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      configs: configs.map((config) => ({
        name: config!.name,
        providerId: config!.providerId,
        modelId: config!.modelId,
        systemPrompt: config!.systemPrompt,
        userPromptTemplate: config!.userPromptTemplate,
        temperature: config!.temperature,
        maxTokens: config!.maxTokens,
        fallbacks: config!.fallbacks.map((fb) => {
          const fbConfig = getConfig(fb.fallbackConfigId)
          return {
            fallbackConfigName: fbConfig?.name || 'Unknown',
            priority: fb.priority,
            conditionType: fb.conditionType
          }
        })
      }))
    }
  })

  // Import configs
  ipcMain.handle('config:import', async (_event, exportData: ConfigExport): Promise<ImportResult> => {
    const result: ImportResult = {
      configsImported: 0,
      configsSkipped: 0,
      templatesImported: 0,
      termsImported: 0,
      warnings: [],
      errors: []
    }

    const configNameToId = new Map<string, string>()

    // First pass: create all configs without fallbacks
    for (const configData of exportData.configs) {
      try {
        // Check for existing config with same name
        const existingConfigs = listConfigs()
        const existing = existingConfigs.find((c) => c.name === configData.name)

        let configName = configData.name
        if (existing) {
          configName = `${configData.name} (imported)`
          result.warnings.push(`Config "${configData.name}" already exists, importing as "${configName}"`)
        }

        const newConfig = createConfig({
          name: configName,
          providerId: configData.providerId,
          modelId: configData.modelId,
          systemPrompt: configData.systemPrompt,
          userPromptTemplate: configData.userPromptTemplate,
          temperature: configData.temperature,
          maxTokens: configData.maxTokens
        })

        configNameToId.set(configData.name, newConfig.id)
        result.configsImported++
      } catch (error) {
        result.errors.push(`Failed to import config "${configData.name}": ${error}`)
        result.configsSkipped++
      }
    }

    // Second pass: create fallback relationships
    for (const configData of exportData.configs) {
      const configId = configNameToId.get(configData.name)
      if (!configId || !configData.fallbacks) continue

      for (const fb of configData.fallbacks) {
        const fallbackConfigId = configNameToId.get(fb.fallbackConfigName)
        if (!fallbackConfigId) {
          result.warnings.push(
            `Could not create fallback "${fb.fallbackConfigName}" for "${configData.name}": config not found`
          )
          continue
        }

        try {
          createFallback(configId, fallbackConfigId, fb.priority, fb.conditionType)
        } catch (error) {
          result.warnings.push(`Failed to create fallback: ${error}`)
        }
      }
    }

    return result
  })

  console.log('[IPC] Config handlers registered')
}
