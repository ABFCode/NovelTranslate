import { getDatabase, generateId } from '../index'
import type { ApiKeyEntry } from '../../../shared/types'

// ============================================================================
// API Key CRUD
// ============================================================================

/**
 * Get all API keys for a provider config
 */
export function listApiKeys(providerConfigId: string): ApiKeyEntry[] {
  const db = getDatabase()
  const stmt = db.prepare(`
    SELECT id, provider_config_id, label, is_valid, last_validated_at, last_error_at,
           last_error, request_count, last_used_at, priority, is_enabled, created_at
    FROM api_keys
    WHERE provider_config_id = ?
    ORDER BY priority ASC, created_at ASC
  `)

  const rows = stmt.all(providerConfigId) as ApiKeyRow[]
  return rows.map(rowToApiKey)
}

/**
 * Get all API keys across all providers
 */
export function listAllApiKeys(): ApiKeyEntry[] {
  const db = getDatabase()
  const stmt = db.prepare(`
    SELECT id, provider_config_id, label, is_valid, last_validated_at, last_error_at,
           last_error, request_count, last_used_at, priority, is_enabled, created_at
    FROM api_keys
    ORDER BY provider_config_id, priority ASC
  `)

  const rows = stmt.all() as ApiKeyRow[]
  return rows.map(rowToApiKey)
}

/**
 * Get a specific API key
 */
export function getApiKey(id: string): ApiKeyEntry | null {
  const db = getDatabase()
  const stmt = db.prepare(`
    SELECT id, provider_config_id, label, is_valid, last_validated_at, last_error_at,
           last_error, request_count, last_used_at, priority, is_enabled, created_at
    FROM api_keys
    WHERE id = ?
  `)

  const row = stmt.get(id) as ApiKeyRow | undefined
  return row ? rowToApiKey(row) : null
}

/**
 * Get the encrypted key value (for actual API calls)
 */
export function getApiKeyValue(id: string): string | null {
  const db = getDatabase()
  const row = db.prepare('SELECT key_encrypted FROM api_keys WHERE id = ?').get(id) as
    | { key_encrypted: string }
    | undefined
  return row?.key_encrypted || null
}

/**
 * Create a new API key
 */
export function createApiKey(
  providerConfigId: string,
  keyEncrypted: string,
  label?: string,
  priority = 0
): ApiKeyEntry {
  const db = getDatabase()
  const id = generateId()
  const now = new Date().toISOString()

  const stmt = db.prepare(`
    INSERT INTO api_keys (
      id, provider_config_id, key_encrypted, label, is_valid, last_validated_at,
      last_error_at, last_error, request_count, last_used_at, priority, is_enabled, created_at
    )
    VALUES (?, ?, ?, ?, 1, NULL, NULL, NULL, 0, NULL, ?, 1, ?)
  `)

  stmt.run(id, providerConfigId, keyEncrypted, label || null, priority, now)

  return {
    id,
    providerConfigId,
    label,
    isValid: true,
    requestCount: 0,
    priority,
    isEnabled: true,
    createdAt: now
  }
}

/**
 * Update an API key's metadata
 */
export function updateApiKey(
  id: string,
  updates: Partial<{
    label: string | null
    priority: number
    isEnabled: boolean
  }>
): void {
  const db = getDatabase()

  const setClauses: string[] = []
  const values: unknown[] = []

  if (updates.label !== undefined) {
    setClauses.push('label = ?')
    values.push(updates.label)
  }
  if (updates.priority !== undefined) {
    setClauses.push('priority = ?')
    values.push(updates.priority)
  }
  if (updates.isEnabled !== undefined) {
    setClauses.push('is_enabled = ?')
    values.push(updates.isEnabled ? 1 : 0)
  }

  if (setClauses.length === 0) return

  values.push(id)
  const stmt = db.prepare(`UPDATE api_keys SET ${setClauses.join(', ')} WHERE id = ?`)
  stmt.run(...values)
}

/**
 * Update the encrypted key value
 */
export function updateApiKeyValue(id: string, keyEncrypted: string): void {
  const db = getDatabase()
  db.prepare('UPDATE api_keys SET key_encrypted = ?, is_valid = 1 WHERE id = ?').run(
    keyEncrypted,
    id
  )
}

/**
 * Delete an API key
 */
export function deleteApiKey(id: string): void {
  const db = getDatabase()
  db.prepare('DELETE FROM api_keys WHERE id = ?').run(id)
}

/**
 * Mark a key as validated
 */
export function markKeyValidated(id: string): void {
  const db = getDatabase()
  const now = new Date().toISOString()

  db.prepare(`
    UPDATE api_keys 
    SET is_valid = 1, last_validated_at = ?, last_error = NULL, last_error_at = NULL
    WHERE id = ?
  `).run(now, id)
}

/**
 * Mark a key as having an error
 */
export function markKeyError(id: string, error: string): void {
  const db = getDatabase()
  const now = new Date().toISOString()

  db.prepare(`
    UPDATE api_keys 
    SET last_error = ?, last_error_at = ?
    WHERE id = ?
  `).run(error, now, id)
}

/**
 * Mark a key as invalid (auth error)
 */
export function markKeyInvalid(id: string, error: string): void {
  const db = getDatabase()
  const now = new Date().toISOString()

  db.prepare(`
    UPDATE api_keys 
    SET is_valid = 0, last_error = ?, last_error_at = ?
    WHERE id = ?
  `).run(error, now, id)
}

/**
 * Record key usage
 */
export function recordKeyUsage(id: string): void {
  const db = getDatabase()
  const now = new Date().toISOString()

  db.prepare(`
    UPDATE api_keys 
    SET request_count = request_count + 1, last_used_at = ?
    WHERE id = ?
  `).run(now, id)
}

/**
 * Get the next available key for a provider config (for rotation)
 */
export function getNextAvailableKey(
  providerConfigId: string,
  strategy: 'priority' | 'round_robin' | 'least_recently_used'
): ApiKeyEntry | null {
  const db = getDatabase()

  let sql: string
  switch (strategy) {
    case 'priority':
      sql = `
        SELECT id, provider_config_id, label, is_valid, last_validated_at, last_error_at,
               last_error, request_count, last_used_at, priority, is_enabled, created_at
        FROM api_keys
        WHERE provider_config_id = ? AND is_enabled = 1 AND is_valid = 1
        ORDER BY priority ASC
        LIMIT 1
      `
      break

    case 'round_robin':
      sql = `
        SELECT id, provider_config_id, label, is_valid, last_validated_at, last_error_at,
               last_error, request_count, last_used_at, priority, is_enabled, created_at
        FROM api_keys
        WHERE provider_config_id = ? AND is_enabled = 1 AND is_valid = 1
        ORDER BY request_count ASC, priority ASC
        LIMIT 1
      `
      break

    case 'least_recently_used':
      sql = `
        SELECT id, provider_config_id, label, is_valid, last_validated_at, last_error_at,
               last_error, request_count, last_used_at, priority, is_enabled, created_at
        FROM api_keys
        WHERE provider_config_id = ? AND is_enabled = 1 AND is_valid = 1
        ORDER BY COALESCE(last_used_at, '1970-01-01') ASC
        LIMIT 1
      `
      break
  }

  const row = db.prepare(sql).get(providerConfigId) as ApiKeyRow | undefined
  return row ? rowToApiKey(row) : null
}

/**
 * Check if provider config has any valid keys
 */
export function hasValidKeys(providerConfigId: string): boolean {
  const db = getDatabase()
  const result = db
    .prepare(
      `
    SELECT COUNT(*) as count FROM api_keys
    WHERE provider_config_id = ? AND is_enabled = 1 AND is_valid = 1
  `
    )
    .get(providerConfigId) as { count: number }

  return result.count > 0
}

// ============================================================================
// Internal helpers
// ============================================================================

interface ApiKeyRow {
  id: string
  provider_config_id: string
  label: string | null
  is_valid: number
  last_validated_at: string | null
  last_error_at: string | null
  last_error: string | null
  request_count: number
  last_used_at: string | null
  priority: number
  is_enabled: number
  created_at: string
}

function rowToApiKey(row: ApiKeyRow): ApiKeyEntry {
  return {
    id: row.id,
    providerConfigId: row.provider_config_id,
    label: row.label || undefined,
    isValid: row.is_valid === 1,
    lastValidatedAt: row.last_validated_at || undefined,
    lastErrorAt: row.last_error_at || undefined,
    lastError: row.last_error || undefined,
    requestCount: row.request_count,
    lastUsedAt: row.last_used_at || undefined,
    priority: row.priority,
    isEnabled: row.is_enabled === 1,
    createdAt: row.created_at
  }
}
