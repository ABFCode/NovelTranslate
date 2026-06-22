import type {
  ConfigFallback,
  ConfigSnapshot,
  ConfigWithFallbacks,
  FallbackConditionType,
  ProjectConfig,
  TranslationConfig,
} from '../../../shared/types'
import { generateId, getDatabase } from '../index'

// ============================================================================
// Translation Config CRUD
// ============================================================================

/**
 * Create a new translation config
 */
export function createConfig(
  config: Omit<TranslationConfig, 'id' | 'createdAt' | 'updatedAt'>
): TranslationConfig {
  const db = getDatabase()
  const id = generateId()
  const now = new Date().toISOString()

  const stmt = db.prepare(`
    INSERT INTO translation_configs (
      id, name, provider_config_id, model_id, system_prompt, user_prompt_template,
      temperature, max_tokens, is_default, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  stmt.run(
    id,
    config.name,
    config.providerConfigId,
    config.modelId,
    config.systemPrompt,
    config.userPromptTemplate,
    config.temperature,
    config.maxTokens || null,
    config.isDefault ? 1 : 0,
    now,
    now
  )

  return { id, ...config, createdAt: now, updatedAt: now }
}

/**
 * Get a config by ID
 */
export function getConfig(id: string): TranslationConfig | null {
  const db = getDatabase()
  const stmt = db.prepare(`
    SELECT id, name, provider_config_id, model_id, system_prompt, user_prompt_template,
           temperature, max_tokens, is_default, created_at, updated_at
    FROM translation_configs
    WHERE id = ?
  `)

  const row = stmt.get(id) as ConfigRow | undefined
  return row ? rowToConfig(row) : null
}

/**
 * Get config with its fallbacks
 */
export function getConfigWithFallbacks(id: string): ConfigWithFallbacks | null {
  const config = getConfig(id)
  if (!config) return null

  const fallbacks = getFallbacksForConfig(id)
  return { ...config, fallbacks }
}

/**
 * Get all configs
 */
export function listConfigs(): TranslationConfig[] {
  const db = getDatabase()
  const stmt = db.prepare(`
    SELECT id, name, provider_config_id, model_id, system_prompt, user_prompt_template,
           temperature, max_tokens, is_default, created_at, updated_at
    FROM translation_configs
    ORDER BY name ASC
  `)

  const rows = stmt.all() as ConfigRow[]
  return rows.map(rowToConfig)
}

/**
 * Get the default config
 */
export function getDefaultConfig(): TranslationConfig | null {
  const db = getDatabase()
  const stmt = db.prepare(`
    SELECT id, name, provider_config_id, model_id, system_prompt, user_prompt_template,
           temperature, max_tokens, is_default, created_at, updated_at
    FROM translation_configs
    WHERE is_default = 1
    LIMIT 1
  `)

  const row = stmt.get() as ConfigRow | undefined
  return row ? rowToConfig(row) : null
}

/**
 * Set a config as the default (unsets previous default)
 */
export function setDefaultConfig(id: string): void {
  const db = getDatabase()

  const transaction = db.transaction(() => {
    // Unset all defaults
    db.prepare('UPDATE translation_configs SET is_default = 0').run()
    // Set the new default
    db.prepare('UPDATE translation_configs SET is_default = 1 WHERE id = ?').run(id)
  })

  transaction()
}

/**
 * Update a config
 */
export function updateConfig(
  id: string,
  updates: Partial<Omit<TranslationConfig, 'id' | 'createdAt' | 'updatedAt'>>,
  createSnapshot = true
): void {
  const db = getDatabase()
  const existing = getConfig(id)

  if (!existing) {
    throw new Error(`Config not found: ${id}`)
  }

  // Create snapshot before updating
  if (createSnapshot) {
    createConfigSnapshot(id, 'edit')
  }

  const updated = { ...existing, ...updates }
  const now = new Date().toISOString()

  const stmt = db.prepare(`
    UPDATE translation_configs
    SET name = ?, provider_config_id = ?, model_id = ?, system_prompt = ?,
        user_prompt_template = ?, temperature = ?, max_tokens = ?,
        is_default = ?, updated_at = ?
    WHERE id = ?
  `)

  stmt.run(
    updated.name,
    updated.providerConfigId,
    updated.modelId,
    updated.systemPrompt,
    updated.userPromptTemplate,
    updated.temperature,
    updated.maxTokens || null,
    updated.isDefault ? 1 : 0,
    now,
    id
  )
}

/**
 * Delete a config
 */
export function deleteConfig(id: string): void {
  const db = getDatabase()
  const stmt = db.prepare('DELETE FROM translation_configs WHERE id = ?')
  stmt.run(id)
}

/**
 * Create default config if none exists
 */
export function ensureDefaultConfig(): TranslationConfig {
  const defaultConfig = getDefaultConfig()
  if (defaultConfig) {
    return defaultConfig
  }

  const configs = listConfigs()
  if (configs.length > 0) {
    setDefaultConfig(configs[0].id)
    return configs[0]
  }

  // Create a sensible default config
  return createConfig({
    name: 'Default',
    providerConfigId: 'openai',
    modelId: 'gpt-4o-mini',
    systemPrompt: `You are a professional translator. Translate the following text accurately while preserving the original meaning, tone, and style. Maintain any formatting present in the original text.`,
    userPromptTemplate: `Translate the following text from {{sourceLanguage}} to {{targetLanguage}}:

{{text}}`,
    temperature: 0.3,
    maxTokens: undefined,
    isDefault: true,
  })
}

// ============================================================================
// Config Fallbacks CRUD
// ============================================================================

/**
 * Get fallbacks for a config, ordered by priority
 */
export function getFallbacksForConfig(configId: string): ConfigFallback[] {
  const db = getDatabase()
  const stmt = db.prepare(`
    SELECT id, config_id, fallback_config_id, priority, condition_type, 
           condition_value, created_at
    FROM config_fallbacks
    WHERE config_id = ?
    ORDER BY priority ASC
  `)

  const rows = stmt.all(configId) as FallbackRow[]
  return rows.map(rowToFallback)
}

/**
 * Create a new fallback for a config
 */
export function createFallback(
  configId: string,
  fallbackConfigId: string,
  priority: number,
  conditionType: FallbackConditionType = 'any',
  conditionValue?: string
): ConfigFallback {
  // Check for cycles
  if (wouldCreateCycle(configId, fallbackConfigId)) {
    throw new Error('Cannot create fallback: would create a cycle in the chain')
  }

  const db = getDatabase()
  const id = generateId()
  const now = new Date().toISOString()

  const stmt = db.prepare(`
    INSERT INTO config_fallbacks (
      id, config_id, fallback_config_id, priority, condition_type, 
      condition_value, created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)

  stmt.run(id, configId, fallbackConfigId, priority, conditionType, conditionValue || null, now)

  return {
    id,
    configId,
    fallbackConfigId,
    priority,
    conditionType,
    conditionValue,
    createdAt: now,
  }
}

/**
 * Update a fallback
 */
export function updateFallback(
  id: string,
  updates: Partial<Omit<ConfigFallback, 'id' | 'configId' | 'createdAt'>>
): void {
  const db = getDatabase()

  // If changing fallbackConfigId, check for cycles
  if (updates.fallbackConfigId) {
    const existing = db.prepare('SELECT config_id FROM config_fallbacks WHERE id = ?').get(id) as
      | { config_id: string }
      | undefined

    if (existing && wouldCreateCycle(existing.config_id, updates.fallbackConfigId)) {
      throw new Error('Cannot update fallback: would create a cycle in the chain')
    }
  }

  const setClauses: string[] = []
  const values: unknown[] = []

  if (updates.fallbackConfigId !== undefined) {
    setClauses.push('fallback_config_id = ?')
    values.push(updates.fallbackConfigId)
  }
  if (updates.priority !== undefined) {
    setClauses.push('priority = ?')
    values.push(updates.priority)
  }
  if (updates.conditionType !== undefined) {
    setClauses.push('condition_type = ?')
    values.push(updates.conditionType)
  }
  if (updates.conditionValue !== undefined) {
    setClauses.push('condition_value = ?')
    values.push(updates.conditionValue || null)
  }

  if (setClauses.length === 0) return

  values.push(id)
  const stmt = db.prepare(`UPDATE config_fallbacks SET ${setClauses.join(', ')} WHERE id = ?`)
  stmt.run(...values)
}

/**
 * Delete a fallback
 */
export function deleteFallback(id: string): void {
  const db = getDatabase()
  db.prepare('DELETE FROM config_fallbacks WHERE id = ?').run(id)
}

/**
 * Delete all fallbacks for a config
 */
export function deleteFallbacksForConfig(configId: string): void {
  const db = getDatabase()
  db.prepare('DELETE FROM config_fallbacks WHERE config_id = ?').run(configId)
}

/**
 * Check if adding a fallback would create a cycle
 */
export function wouldCreateCycle(sourceConfigId: string, targetConfigId: string): boolean {
  if (sourceConfigId === targetConfigId) return true

  const visited = new Set<string>()
  const stack = [targetConfigId]

  while (stack.length > 0) {
    const current = stack.pop()!
    if (current === sourceConfigId) return true
    if (visited.has(current)) continue

    visited.add(current)
    const fallbacks = getFallbacksForConfig(current)
    for (const fb of fallbacks) {
      stack.push(fb.fallbackConfigId)
    }
  }

  return false
}

// ============================================================================
// Config Snapshots
// ============================================================================

/**
 * Create a snapshot of a config
 */
export function createConfigSnapshot(
  configId: string,
  reason: 'edit' | 'test' | 'translation'
): ConfigSnapshot {
  const db = getDatabase()
  const config = getConfig(configId)

  if (!config) {
    throw new Error(`Config not found: ${configId}`)
  }

  // Get the next version number
  const versionResult = db
    .prepare(
      'SELECT COALESCE(MAX(version), 0) + 1 as next_version FROM config_snapshots WHERE config_id = ?'
    )
    .get(configId) as { next_version: number }

  const id = generateId()
  const now = new Date().toISOString()

  const stmt = db.prepare(`
    INSERT INTO config_snapshots (
      id, config_id, version, name, provider_config_id, model_id, system_prompt,
      user_prompt_template, temperature, max_tokens, reason, created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  stmt.run(
    id,
    configId,
    versionResult.next_version,
    config.name,
    config.providerConfigId,
    config.modelId,
    config.systemPrompt,
    config.userPromptTemplate,
    config.temperature,
    config.maxTokens || null,
    reason,
    now
  )

  return {
    id,
    configId,
    version: versionResult.next_version,
    name: config.name,
    providerConfigId: config.providerConfigId,
    modelId: config.modelId,
    systemPrompt: config.systemPrompt,
    userPromptTemplate: config.userPromptTemplate,
    temperature: config.temperature,
    maxTokens: config.maxTokens,
    reason,
    createdAt: now,
  }
}

/**
 * Get snapshots for a config
 */
export function getSnapshotsForConfig(configId: string): ConfigSnapshot[] {
  const db = getDatabase()
  const stmt = db.prepare(`
    SELECT id, config_id, version, name, provider_config_id, model_id, system_prompt,
           user_prompt_template, temperature, max_tokens, reason, created_at
    FROM config_snapshots
    WHERE config_id = ?
    ORDER BY version DESC
  `)

  const rows = stmt.all(configId) as SnapshotRow[]
  return rows.map(rowToSnapshot)
}

/**
 * Get a specific snapshot
 */
export function getSnapshot(id: string): ConfigSnapshot | null {
  const db = getDatabase()
  const stmt = db.prepare(`
    SELECT id, config_id, version, name, provider_config_id, model_id, system_prompt,
           user_prompt_template, temperature, max_tokens, reason, created_at
    FROM config_snapshots
    WHERE id = ?
  `)

  const row = stmt.get(id) as SnapshotRow | undefined
  return row ? rowToSnapshot(row) : null
}

/**
 * Restore a config from a snapshot
 */
export function restoreFromSnapshot(snapshotId: string): void {
  const snapshot = getSnapshot(snapshotId)
  if (!snapshot) {
    throw new Error(`Snapshot not found: ${snapshotId}`)
  }

  updateConfig(
    snapshot.configId,
    {
      name: snapshot.name,
      providerConfigId: snapshot.providerConfigId,
      modelId: snapshot.modelId,
      systemPrompt: snapshot.systemPrompt,
      userPromptTemplate: snapshot.userPromptTemplate,
      temperature: snapshot.temperature,
      maxTokens: snapshot.maxTokens,
    },
    true // Create a new snapshot before restoring
  )
}

// ============================================================================
// Project Configs
// ============================================================================

/**
 * Get configs assigned to a project
 */
export function getProjectConfigs(projectId: string): ProjectConfig[] {
  const db = getDatabase()
  const stmt = db.prepare(`
    SELECT project_id, config_id, is_default, priority, created_at
    FROM project_configs
    WHERE project_id = ?
    ORDER BY priority ASC
  `)

  const rows = stmt.all(projectId) as ProjectConfigRow[]
  return rows.map(rowToProjectConfig)
}

/**
 * Get the default config for a project (or global default if none set)
 */
export function getProjectDefaultConfig(projectId: string): TranslationConfig | null {
  const db = getDatabase()

  // First check for project-specific default
  const projectDefault = db
    .prepare(
      `
    SELECT config_id FROM project_configs 
    WHERE project_id = ? AND is_default = 1
    LIMIT 1
  `
    )
    .get(projectId) as { config_id: string } | undefined

  if (projectDefault) {
    return getConfig(projectDefault.config_id)
  }

  // Fall back to global default
  return getDefaultConfig()
}

/**
 * Assign a config to a project
 */
export function assignConfigToProject(
  projectId: string,
  configId: string,
  isDefault = false,
  priority = 0
): ProjectConfig {
  const db = getDatabase()
  const now = new Date().toISOString()

  // If setting as default, unset other defaults for this project
  if (isDefault) {
    db.prepare('UPDATE project_configs SET is_default = 0 WHERE project_id = ?').run(projectId)
  }

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO project_configs (project_id, config_id, is_default, priority, created_at)
    VALUES (?, ?, ?, ?, ?)
  `)

  stmt.run(projectId, configId, isDefault ? 1 : 0, priority, now)

  return { projectId, configId, isDefault, priority, createdAt: now }
}

/**
 * Remove a config from a project
 */
export function removeConfigFromProject(projectId: string, configId: string): void {
  const db = getDatabase()
  db.prepare('DELETE FROM project_configs WHERE project_id = ? AND config_id = ?').run(
    projectId,
    configId
  )
}

// ============================================================================
// Internal helpers
// ============================================================================

interface ConfigRow {
  id: string
  name: string
  provider_config_id: string
  model_id: string
  system_prompt: string
  user_prompt_template: string
  temperature: number
  max_tokens: number | null
  is_default: number
  created_at: string
  updated_at: string
}

interface FallbackRow {
  id: string
  config_id: string
  fallback_config_id: string
  priority: number
  condition_type: string
  condition_value: string | null
  created_at: string
}

interface SnapshotRow {
  id: string
  config_id: string
  version: number
  name: string
  provider_config_id: string
  model_id: string
  system_prompt: string
  user_prompt_template: string
  temperature: number
  max_tokens: number | null
  reason: string
  created_at: string
}

interface ProjectConfigRow {
  project_id: string
  config_id: string
  is_default: number
  priority: number
  created_at: string
}

function rowToConfig(row: ConfigRow): TranslationConfig {
  return {
    id: row.id,
    name: row.name,
    providerConfigId: row.provider_config_id,
    modelId: row.model_id,
    systemPrompt: row.system_prompt,
    userPromptTemplate: row.user_prompt_template,
    temperature: row.temperature,
    maxTokens: row.max_tokens || undefined,
    isDefault: row.is_default === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function rowToFallback(row: FallbackRow): ConfigFallback {
  return {
    id: row.id,
    configId: row.config_id,
    fallbackConfigId: row.fallback_config_id,
    priority: row.priority,
    conditionType: row.condition_type as FallbackConditionType,
    conditionValue: row.condition_value || undefined,
    createdAt: row.created_at,
  }
}

function rowToSnapshot(row: SnapshotRow): ConfigSnapshot {
  return {
    id: row.id,
    configId: row.config_id,
    version: row.version,
    name: row.name,
    providerConfigId: row.provider_config_id,
    modelId: row.model_id,
    systemPrompt: row.system_prompt,
    userPromptTemplate: row.user_prompt_template,
    temperature: row.temperature,
    maxTokens: row.max_tokens || undefined,
    reason: row.reason as 'edit' | 'test' | 'translation',
    createdAt: row.created_at,
  }
}

function rowToProjectConfig(row: ProjectConfigRow): ProjectConfig {
  return {
    projectId: row.project_id,
    configId: row.config_id,
    isDefault: row.is_default === 1,
    priority: row.priority,
    createdAt: row.created_at,
  }
}
