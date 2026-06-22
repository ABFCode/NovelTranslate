import type {
  ConfigExport,
  ConfigFallback,
  ConfigSnapshot,
  ConfigWithFallbacks,
  FallbackConditionType,
  ImportResult,
  ProjectConfig,
  PromptTemplate,
  TranslationConfig,
} from '../../shared/types'
import {
  configImportSchema,
  promptTemplateSchema,
  translationConfigSchema,
} from '../../shared/validation'
import {
  assignConfigToProject,
  createConfig,
  createConfigSnapshot,
  createFallback,
  deleteConfig,
  deleteFallback,
  getConfig,
  getConfigWithFallbacks,
  getDefaultConfig,
  getFallbacksForConfig,
  getProjectConfigs,
  getProjectDefaultConfig,
  getSnapshot,
  getSnapshotsForConfig,
  listConfigs,
  removeConfigFromProject,
  restoreFromSnapshot,
  setDefaultConfig,
  updateConfig,
  updateFallback,
  wouldCreateCycle,
} from '../database'
import { listEnabledProviderConfigs } from '../database/repositories/provider-config.repository'
import {
  cloneTemplate,
  createTemplate,
  deleteTemplate,
  getTemplate,
  incrementTemplateUsage,
  listTemplates,
  updateTemplate,
} from '../database/repositories/template.repository'
import { providerConfigService } from '../providers/provider-config.service'
import { logger } from '../services/logger'
import { assertNonEmptyString, handleIpc, validateInput } from './utils'

/**
 * Register config-related IPC handlers
 */
export function registerConfigHandlers(): void {
  // ============================================================================
  // Config CRUD
  // ============================================================================

  // List all configs
  handleIpc('config:list', (): TranslationConfig[] => {
    return listConfigs()
  })

  // Get a config by ID
  handleIpc('config:get', (id: string): TranslationConfig | null => {
    return getConfig(id)
  })

  // Get a config with its fallbacks
  handleIpc('config:getWithFallbacks', (id: string): ConfigWithFallbacks | null => {
    return getConfigWithFallbacks(id)
  })

  // Save a config (create or update)
  handleIpc('config:save', (config: TranslationConfig): TranslationConfig => {
    validateInput(translationConfigSchema, config, 'config')
    const existing = getConfig(config.id)

    if (existing) {
      updateConfig(config.id, config)
      return { ...existing, ...config }
    } else {
      return createConfig(config)
    }
  })

  // Delete a config
  handleIpc('config:delete', (id: string): void => {
    assertNonEmptyString(id, 'config id')
    deleteConfig(id)
  })

  // Get/set default config
  handleIpc('config:getDefault', (): TranslationConfig | null => {
    return getDefaultConfig()
  })

  handleIpc('config:setDefault', (id: string): void => {
    setDefaultConfig(id)
  })

  // ============================================================================
  // Fallback Chain Management
  // ============================================================================

  // Get fallbacks for a config
  handleIpc('config:getFallbacks', (configId: string): ConfigFallback[] => {
    return getFallbacksForConfig(configId)
  })

  // Create a fallback
  handleIpc(
    'config:createFallback',
    (
      configId: string,
      fallbackConfigId: string,
      priority: number,
      conditionType: FallbackConditionType,
      conditionValue?: string
    ): ConfigFallback => {
      return createFallback(configId, fallbackConfigId, priority, conditionType, conditionValue)
    }
  )

  // Update a fallback
  handleIpc(
    'config:updateFallback',
    (id: string, updates: Partial<Omit<ConfigFallback, 'id' | 'configId' | 'createdAt'>>): void => {
      updateFallback(id, updates)
    }
  )

  // Delete a fallback
  handleIpc('config:deleteFallback', (id: string): void => {
    deleteFallback(id)
  })

  // Check if fallback would create a cycle
  handleIpc(
    'config:wouldCreateCycle',
    (sourceConfigId: string, targetConfigId: string): boolean => {
      return wouldCreateCycle(sourceConfigId, targetConfigId)
    }
  )

  // ============================================================================
  // Snapshots (Versioning)
  // ============================================================================

  // Get snapshots for a config
  handleIpc('config:getSnapshots', (configId: string): ConfigSnapshot[] => {
    return getSnapshotsForConfig(configId)
  })

  // Get a specific snapshot
  handleIpc('config:getSnapshot', (id: string): ConfigSnapshot | null => {
    return getSnapshot(id)
  })

  // Create a snapshot manually
  handleIpc(
    'config:createSnapshot',
    (configId: string, reason: 'edit' | 'test' | 'translation'): ConfigSnapshot => {
      return createConfigSnapshot(configId, reason)
    }
  )

  // Restore from a snapshot
  handleIpc('config:restoreSnapshot', (snapshotId: string): void => {
    restoreFromSnapshot(snapshotId)
  })

  // ============================================================================
  // Project Configs
  // ============================================================================

  // Get configs assigned to a project
  handleIpc('projectConfig:list', (projectId: string): ProjectConfig[] => {
    return getProjectConfigs(projectId)
  })

  // Get the default config for a project
  handleIpc('projectConfig:getDefault', (projectId: string): TranslationConfig | null => {
    return getProjectDefaultConfig(projectId)
  })

  // Assign a config to a project
  handleIpc(
    'projectConfig:assign',
    (projectId: string, configId: string, isDefault: boolean, priority: number): ProjectConfig => {
      return assignConfigToProject(projectId, configId, isDefault, priority)
    }
  )

  // Remove a config from a project
  handleIpc('projectConfig:remove', (projectId: string, configId: string): void => {
    removeConfigFromProject(projectId, configId)
  })

  // ============================================================================
  // Templates
  // ============================================================================

  // List all templates
  handleIpc('template:list', (): PromptTemplate[] => {
    return listTemplates()
  })

  // Get a template
  handleIpc('template:get', (id: string): PromptTemplate | null => {
    return getTemplate(id)
  })

  // Create a template
  handleIpc(
    'template:create',
    (
      template: Omit<PromptTemplate, 'id' | 'isBuiltIn' | 'usageCount' | 'createdAt'>
    ): PromptTemplate => {
      validateInput(promptTemplateSchema, template, 'template')
      return createTemplate(template)
    }
  )

  // Update a template
  handleIpc(
    'template:update',
    (
      id: string,
      updates: Partial<Omit<PromptTemplate, 'id' | 'isBuiltIn' | 'usageCount' | 'createdAt'>>
    ): void => {
      updateTemplate(id, updates)
    }
  )

  // Delete a template
  handleIpc('template:delete', (id: string): void => {
    deleteTemplate(id)
  })

  // Clone a template
  handleIpc('template:clone', (id: string, newName: string): PromptTemplate => {
    return cloneTemplate(id, newName)
  })

  // Use a template (increment usage and create config)
  handleIpc('template:use', (templateId: string, configName: string): TranslationConfig => {
    const template = getTemplate(templateId)
    if (!template) {
      throw new Error(`Template not found: ${templateId}`)
    }

    incrementTemplateUsage(templateId)

    // Pick a provider config to attach the new config to. Templates are
    // provider-agnostic, so default to the first enabled provider config.
    const providerConfigs = listEnabledProviderConfigs()
    if (providerConfigs.length === 0) {
      throw new Error(
        'No provider configured. Add a provider before creating a config from a template.'
      )
    }
    const defaultProvider = providerConfigs[0]
    const defaultModel = providerConfigService.getModelsForProvider(defaultProvider)[0]?.id ?? ''

    // Create a config from the template
    return createConfig({
      name: configName,
      providerConfigId: defaultProvider.id,
      modelId: defaultModel,
      systemPrompt: template.systemPrompt,
      userPromptTemplate: template.userPromptTemplate,
      temperature: template.suggestedTemperature,
      maxTokens: template.suggestedMaxTokens,
    })
  })

  // ============================================================================
  // Import/Export
  // ============================================================================

  // Export configs
  handleIpc('config:export', (configIds: string[]): ConfigExport => {
    const configs = configIds.map((id) => getConfigWithFallbacks(id)).filter(Boolean)

    return {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      configs: configs.map((config) => ({
        name: config!.name,
        providerConfigId: config!.providerConfigId,
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
            conditionType: fb.conditionType,
          }
        }),
      })),
    }
  })

  // Import configs
  handleIpc('config:import', (exportData: ConfigExport): ImportResult => {
    validateInput(configImportSchema, exportData, 'config import data')
    const result: ImportResult = {
      configsImported: 0,
      configsSkipped: 0,
      templatesImported: 0,
      termsImported: 0,
      warnings: [],
      errors: [],
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
          result.warnings.push(
            `Config "${configData.name}" already exists, importing as "${configName}"`
          )
        }

        const newConfig = createConfig({
          name: configName,
          providerConfigId: configData.providerConfigId,
          modelId: configData.modelId,
          systemPrompt: configData.systemPrompt,
          userPromptTemplate: configData.userPromptTemplate,
          temperature: configData.temperature,
          maxTokens: configData.maxTokens,
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

  logger.info('[IPC] Config handlers registered')
}
