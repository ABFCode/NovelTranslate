import { getDatabase, generateId } from '../index'
import type { TranslationConfig } from '../../../shared/types'

/**
 * Create a new translation config
 */
export function createConfig(config: Omit<TranslationConfig, 'id'>): TranslationConfig {
  const db = getDatabase()
  const id = generateId()
  const now = new Date().toISOString()

  const stmt = db.prepare(`
    INSERT INTO translation_configs (
      id, name, provider_id, model_id, system_prompt, user_prompt_template,
      temperature, max_tokens, fallback_config_ids_json, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  stmt.run(
    id,
    config.name,
    config.providerId,
    config.modelId,
    config.systemPrompt,
    config.userPromptTemplate,
    config.temperature,
    config.maxTokens || null,
    JSON.stringify(config.fallbackConfigIds),
    now,
    now
  )

  return { id, ...config }
}

/**
 * Get a config by ID
 */
export function getConfig(id: string): TranslationConfig | null {
  const db = getDatabase()
  const stmt = db.prepare(`
    SELECT id, name, provider_id, model_id, system_prompt, user_prompt_template,
           temperature, max_tokens, fallback_config_ids_json
    FROM translation_configs
    WHERE id = ?
  `)

  const row = stmt.get(id) as ConfigRow | undefined
  return row ? rowToConfig(row) : null
}

/**
 * Get all configs
 */
export function listConfigs(): TranslationConfig[] {
  const db = getDatabase()
  const stmt = db.prepare(`
    SELECT id, name, provider_id, model_id, system_prompt, user_prompt_template,
           temperature, max_tokens, fallback_config_ids_json
    FROM translation_configs
    ORDER BY name ASC
  `)

  const rows = stmt.all() as ConfigRow[]
  return rows.map(rowToConfig)
}

/**
 * Update a config
 */
export function updateConfig(id: string, updates: Partial<Omit<TranslationConfig, 'id'>>): void {
  const db = getDatabase()
  const existing = getConfig(id)

  if (!existing) {
    throw new Error(`Config not found: ${id}`)
  }

  const updated = { ...existing, ...updates }
  const now = new Date().toISOString()

  const stmt = db.prepare(`
    UPDATE translation_configs
    SET name = ?, provider_id = ?, model_id = ?, system_prompt = ?,
        user_prompt_template = ?, temperature = ?, max_tokens = ?,
        fallback_config_ids_json = ?, updated_at = ?
    WHERE id = ?
  `)

  stmt.run(
    updated.name,
    updated.providerId,
    updated.modelId,
    updated.systemPrompt,
    updated.userPromptTemplate,
    updated.temperature,
    updated.maxTokens || null,
    JSON.stringify(updated.fallbackConfigIds),
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
  const configs = listConfigs()

  if (configs.length > 0) {
    return configs[0]
  }

  // Create a sensible default config
  return createConfig({
    name: 'Default',
    providerId: 'openai',
    modelId: 'gpt-4o-mini',
    systemPrompt: `You are a professional translator. Translate the following text accurately while preserving the original meaning, tone, and style. Maintain any formatting present in the original text.`,
    userPromptTemplate: `Translate the following text from {{sourceLanguage}} to {{targetLanguage}}:

{{text}}`,
    temperature: 0.3,
    maxTokens: undefined,
    fallbackConfigIds: [],
  })
}

// ============================================================================
// Internal helpers
// ============================================================================

interface ConfigRow {
  id: string
  name: string
  provider_id: string
  model_id: string
  system_prompt: string
  user_prompt_template: string
  temperature: number
  max_tokens: number | null
  fallback_config_ids_json: string
}

function rowToConfig(row: ConfigRow): TranslationConfig {
  return {
    id: row.id,
    name: row.name,
    providerId: row.provider_id,
    modelId: row.model_id,
    systemPrompt: row.system_prompt,
    userPromptTemplate: row.user_prompt_template,
    temperature: row.temperature,
    maxTokens: row.max_tokens || undefined,
    fallbackConfigIds: JSON.parse(row.fallback_config_ids_json),
  }
}
