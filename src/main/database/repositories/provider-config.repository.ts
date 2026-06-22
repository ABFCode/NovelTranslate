import type {
  BuiltinProviderId,
  ModelInfo,
  ProviderConfig,
  ProviderSettings,
  ProviderType,
} from '../../../shared/types'
import { generateId, getDatabase } from '../index'

// ============================================================================
// Provider Config CRUD
// ============================================================================

/**
 * Get all provider configs
 */
export function listProviderConfigs(): ProviderConfig[] {
  const db = getDatabase()
  const stmt = db.prepare(`
    SELECT id, provider_type, builtin_id, display_name, base_url,
           models_json, is_enabled, sort_order, settings_json, created_at, updated_at
    FROM provider_configs
    ORDER BY sort_order ASC, created_at ASC
  `)

  const rows = stmt.all() as ProviderConfigRow[]
  return rows.map(rowToProviderConfig)
}

/**
 * Get enabled provider configs
 */
export function listEnabledProviderConfigs(): ProviderConfig[] {
  const db = getDatabase()
  const stmt = db.prepare(`
    SELECT id, provider_type, builtin_id, display_name, base_url,
           models_json, is_enabled, sort_order, settings_json, created_at, updated_at
    FROM provider_configs
    WHERE is_enabled = 1
    ORDER BY sort_order ASC, created_at ASC
  `)

  const rows = stmt.all() as ProviderConfigRow[]
  return rows.map(rowToProviderConfig)
}

/**
 * Get a specific provider config
 */
export function getProviderConfig(id: string): ProviderConfig | null {
  const db = getDatabase()
  const stmt = db.prepare(`
    SELECT id, provider_type, builtin_id, display_name, base_url,
           models_json, is_enabled, sort_order, settings_json, created_at, updated_at
    FROM provider_configs
    WHERE id = ?
  `)

  const row = stmt.get(id) as ProviderConfigRow | undefined
  return row ? rowToProviderConfig(row) : null
}

/**
 * Find provider config by builtin ID (for checking if a builtin provider is already configured)
 */
export function findProviderConfigByBuiltinId(builtinId: BuiltinProviderId): ProviderConfig | null {
  const db = getDatabase()
  const stmt = db.prepare(`
    SELECT id, provider_type, builtin_id, display_name, base_url,
           models_json, is_enabled, sort_order, settings_json, created_at, updated_at
    FROM provider_configs
    WHERE builtin_id = ?
    LIMIT 1
  `)

  const row = stmt.get(builtinId) as ProviderConfigRow | undefined
  return row ? rowToProviderConfig(row) : null
}

/**
 * Create a new provider config
 */
export function createProviderConfig(
  config: Omit<ProviderConfig, 'id' | 'createdAt' | 'updatedAt'>
): ProviderConfig {
  const db = getDatabase()
  const id = generateId()
  const now = new Date().toISOString()

  const stmt = db.prepare(`
    INSERT INTO provider_configs (
      id, provider_type, builtin_id, display_name, base_url,
      models_json, is_enabled, sort_order, settings_json, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  stmt.run(
    id,
    config.providerType,
    config.builtinId || null,
    config.displayName,
    config.baseUrl || null,
    config.customModels ? JSON.stringify(config.customModels) : null,
    config.isEnabled ? 1 : 0,
    config.sortOrder,
    JSON.stringify(config.settings),
    now,
    now
  )

  return {
    id,
    ...config,
    createdAt: now,
    updatedAt: now,
  }
}

/**
 * Update a provider config
 */
export function updateProviderConfig(
  id: string,
  updates: Partial<Omit<ProviderConfig, 'id' | 'createdAt' | 'updatedAt'>>
): void {
  const db = getDatabase()
  const now = new Date().toISOString()

  const setClauses: string[] = ['updated_at = ?']
  const values: unknown[] = [now]

  if (updates.providerType !== undefined) {
    setClauses.push('provider_type = ?')
    values.push(updates.providerType)
  }
  if (updates.builtinId !== undefined) {
    setClauses.push('builtin_id = ?')
    values.push(updates.builtinId || null)
  }
  if (updates.displayName !== undefined) {
    setClauses.push('display_name = ?')
    values.push(updates.displayName)
  }
  if (updates.baseUrl !== undefined) {
    setClauses.push('base_url = ?')
    values.push(updates.baseUrl || null)
  }
  if (updates.customModels !== undefined) {
    setClauses.push('models_json = ?')
    values.push(updates.customModels ? JSON.stringify(updates.customModels) : null)
  }
  if (updates.isEnabled !== undefined) {
    setClauses.push('is_enabled = ?')
    values.push(updates.isEnabled ? 1 : 0)
  }
  if (updates.sortOrder !== undefined) {
    setClauses.push('sort_order = ?')
    values.push(updates.sortOrder)
  }
  if (updates.settings !== undefined) {
    setClauses.push('settings_json = ?')
    values.push(JSON.stringify(updates.settings))
  }

  values.push(id)
  const stmt = db.prepare(`UPDATE provider_configs SET ${setClauses.join(', ')} WHERE id = ?`)
  stmt.run(...values)
}

/**
 * Delete a provider config
 */
export function deleteProviderConfig(id: string): void {
  const db = getDatabase()
  db.prepare('DELETE FROM provider_configs WHERE id = ?').run(id)
}

/**
 * Check if a provider config has any translation configs referencing it
 */
export function hasTranslationConfigsForProvider(providerConfigId: string): boolean {
  const db = getDatabase()
  const result = db
    .prepare('SELECT COUNT(*) as count FROM translation_configs WHERE provider_config_id = ?')
    .get(providerConfigId) as { count: number }
  return result.count > 0
}

/**
 * Get aggregate stats for a provider config
 */
export function getProviderConfigStats(providerConfigId: string): {
  keyCount: number
  validKeyCount: number
  totalRequests: number
} {
  const db = getDatabase()

  const keyStats = db
    .prepare(`
    SELECT
      COUNT(*) as key_count,
      SUM(CASE WHEN is_valid = 1 AND is_enabled = 1 THEN 1 ELSE 0 END) as valid_key_count,
      SUM(request_count) as total_requests
    FROM api_keys
    WHERE provider_config_id = ?
  `)
    .get(providerConfigId) as {
    key_count: number
    valid_key_count: number
    total_requests: number
  }

  return {
    keyCount: keyStats.key_count || 0,
    validKeyCount: keyStats.valid_key_count || 0,
    totalRequests: keyStats.total_requests || 0,
  }
}

/**
 * Reorder provider configs
 */
export function reorderProviderConfigs(orderedIds: string[]): void {
  const db = getDatabase()

  const updateStmt = db.prepare('UPDATE provider_configs SET sort_order = ? WHERE id = ?')

  const transaction = db.transaction((ids: string[]) => {
    ids.forEach((id, index) => {
      updateStmt.run(index, id)
    })
  })

  transaction(orderedIds)
}

// ============================================================================
// Internal helpers
// ============================================================================

interface ProviderConfigRow {
  id: string
  provider_type: string
  builtin_id: string | null
  display_name: string
  base_url: string | null
  models_json: string | null
  is_enabled: number
  sort_order: number
  settings_json: string
  created_at: string
  updated_at: string
}

function rowToProviderConfig(row: ProviderConfigRow): ProviderConfig {
  let customModels: ModelInfo[] | undefined
  if (row.models_json) {
    try {
      customModels = JSON.parse(row.models_json)
    } catch {
      customModels = undefined
    }
  }

  let settings: ProviderSettings = {}
  if (row.settings_json) {
    try {
      settings = JSON.parse(row.settings_json)
    } catch {
      settings = {}
    }
  }

  return {
    id: row.id,
    providerType: row.provider_type as ProviderType,
    builtinId: row.builtin_id as BuiltinProviderId | undefined,
    displayName: row.display_name,
    baseUrl: row.base_url || undefined,
    customModels,
    isEnabled: row.is_enabled === 1,
    sortOrder: row.sort_order,
    settings,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
