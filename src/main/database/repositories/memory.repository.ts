import { getDatabase, generateId } from '../index'
import type { TranslationMemoryEntry, TranslationOverride } from '../../../shared/types'
import { createHash } from 'crypto'

// ============================================================================
// Hash Utilities
// ============================================================================

/**
 * Create a hash of the source text for memory lookup
 */
export function hashSourceText(text: string): string {
  // Normalize text: trim, lowercase, collapse whitespace
  const normalized = text.trim().toLowerCase().replace(/\s+/g, ' ')
  return createHash('sha256').update(normalized).digest('hex')
}

// ============================================================================
// Translation Memory CRUD
// ============================================================================

/**
 * Get a cached translation by source hash
 */
export function getMemoryEntry(
  sourceHash: string,
  configId?: string,
  projectId?: string
): TranslationMemoryEntry | null {
  const db = getDatabase()

  // Try to find a match with same config first, then fallback to any
  let sql = `
    SELECT id, source_hash, source_text, target_text, provider_config_id, model_id,
           config_id, project_id, confidence, manually_verified, usage_count,
           last_used_at, created_at
    FROM translation_memory
    WHERE source_hash = ?
  `
  const params: unknown[] = [sourceHash]

  if (projectId) {
    sql += ' AND (project_id = ? OR project_id IS NULL)'
    params.push(projectId)
  }

  if (configId) {
    sql += ' ORDER BY CASE WHEN config_id = ? THEN 0 ELSE 1 END, manually_verified DESC, confidence DESC'
    params.push(configId)
  } else {
    sql += ' ORDER BY manually_verified DESC, confidence DESC'
  }

  sql += ' LIMIT 1'

  const row = db.prepare(sql).get(...params) as MemoryRow | undefined
  return row ? rowToMemoryEntry(row) : null
}

/**
 * Get memory entry by source text (computes hash)
 */
export function getMemoryBySourceText(
  sourceText: string,
  configId?: string,
  projectId?: string
): TranslationMemoryEntry | null {
  const hash = hashSourceText(sourceText)
  return getMemoryEntry(hash, configId, projectId)
}

/**
 * Cache a translation result
 */
export function cacheTranslation(
  sourceText: string,
  targetText: string,
  providerConfigId: string,
  modelId: string,
  configId?: string,
  projectId?: string
): TranslationMemoryEntry {
  const db = getDatabase()
  const id = generateId()
  const now = new Date().toISOString()
  const sourceHash = hashSourceText(sourceText)

  const stmt = db.prepare(`
    INSERT INTO translation_memory (
      id, source_hash, source_text, target_text, provider_config_id, model_id,
      config_id, project_id, confidence, manually_verified, usage_count,
      last_used_at, created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1.0, 0, 1, ?, ?)
  `)

  stmt.run(
    id,
    sourceHash,
    sourceText,
    targetText,
    providerConfigId,
    modelId,
    configId || null,
    projectId || null,
    now,
    now
  )

  return {
    id,
    sourceHash,
    sourceText,
    targetText,
    providerConfigId,
    modelId,
    configId,
    projectId,
    confidence: 1.0,
    manuallyVerified: false,
    usageCount: 1,
    lastUsedAt: now,
    createdAt: now
  }
}

/**
 * Increment usage count and update last used timestamp
 */
export function incrementMemoryUsage(id: string): void {
  const db = getDatabase()
  const now = new Date().toISOString()

  db.prepare(`
    UPDATE translation_memory 
    SET usage_count = usage_count + 1, last_used_at = ?
    WHERE id = ?
  `).run(now, id)
}

/**
 * Mark a memory entry as manually verified
 */
export function verifyMemoryEntry(id: string): void {
  const db = getDatabase()
  db.prepare('UPDATE translation_memory SET manually_verified = 1 WHERE id = ?').run(id)
}

/**
 * Update the confidence score of a memory entry
 */
export function updateMemoryConfidence(id: string, confidence: number): void {
  const db = getDatabase()
  db.prepare('UPDATE translation_memory SET confidence = ? WHERE id = ?').run(confidence, id)
}

/**
 * Delete a memory entry
 */
export function deleteMemoryEntry(id: string): void {
  const db = getDatabase()
  db.prepare('DELETE FROM translation_memory WHERE id = ?').run(id)
}

/**
 * List memory entries for a project
 */
export function listMemoryEntries(
  projectId?: string,
  limit = 100,
  offset = 0
): TranslationMemoryEntry[] {
  const db = getDatabase()

  let sql = `
    SELECT id, source_hash, source_text, target_text, provider_config_id, model_id,
           config_id, project_id, confidence, manually_verified, usage_count,
           last_used_at, created_at
    FROM translation_memory
  `
  const params: unknown[] = []

  if (projectId) {
    sql += ' WHERE project_id = ? OR project_id IS NULL'
    params.push(projectId)
  }

  sql += ' ORDER BY last_used_at DESC LIMIT ? OFFSET ?'
  params.push(limit, offset)

  const rows = db.prepare(sql).all(...params) as MemoryRow[]
  return rows.map(rowToMemoryEntry)
}

/**
 * Search memory entries by query text
 */
export function searchMemory(
  query: string,
  projectId?: string,
  limit = 50
): TranslationMemoryEntry[] {
  const db = getDatabase()
  const searchPattern = `%${query}%`

  let sql = `
    SELECT id, source_hash, source_text, target_text, provider_config_id, model_id,
           config_id, project_id, confidence, manually_verified, usage_count,
           last_used_at, created_at
    FROM translation_memory
    WHERE (source_text LIKE ? OR target_text LIKE ?)
  `
  const params: unknown[] = [searchPattern, searchPattern]

  if (projectId) {
    sql += ' AND (project_id = ? OR project_id IS NULL)'
    params.push(projectId)
  }

  sql += ' ORDER BY usage_count DESC, last_used_at DESC LIMIT ?'
  params.push(limit)

  const rows = db.prepare(sql).all(...params) as MemoryRow[]
  return rows.map(rowToMemoryEntry)
}

/**
 * Get override by ID
 */
export function getOverrideById(id: string): TranslationOverride | null {
  const db = getDatabase()
  const row = db.prepare(`
    SELECT id, project_id, chapter_id, source_segment, original_translation,
           override_translation, scope, reason, created_at
    FROM translation_overrides
    WHERE id = ?
  `).get(id) as OverrideRow | undefined
  return row ? rowToOverride(row) : null
}

/**
 * Get memory statistics
 */
export function getMemoryStats(projectId?: string): {
  totalEntries: number
  verifiedEntries: number
  totalUsageCount: number
} {
  const db = getDatabase()

  let sql = `
    SELECT 
      COUNT(*) as total_entries,
      SUM(CASE WHEN manually_verified = 1 THEN 1 ELSE 0 END) as verified_entries,
      SUM(usage_count) as total_usage_count
    FROM translation_memory
  `

  if (projectId) {
    sql += ' WHERE project_id = ? OR project_id IS NULL'
    const row = db.prepare(sql).get(projectId) as {
      total_entries: number
      verified_entries: number
      total_usage_count: number
    }
    return {
      totalEntries: row.total_entries,
      verifiedEntries: row.verified_entries || 0,
      totalUsageCount: row.total_usage_count || 0
    }
  }

  const row = db.prepare(sql).get() as {
    total_entries: number
    verified_entries: number
    total_usage_count: number
  }
  return {
    totalEntries: row.total_entries,
    verifiedEntries: row.verified_entries || 0,
    totalUsageCount: row.total_usage_count || 0
  }
}

/**
 * Clear old unused memory entries
 */
export function cleanupUnusedMemory(olderThanDays = 90, maxUsageCount = 1): number {
  const db = getDatabase()
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - olderThanDays)

  const result = db.prepare(`
    DELETE FROM translation_memory 
    WHERE last_used_at < ? AND usage_count <= ? AND manually_verified = 0
  `).run(cutoff.toISOString(), maxUsageCount)

  return result.changes
}

// ============================================================================
// Translation Overrides CRUD
// ============================================================================

/**
 * Create a translation override
 */
export function createOverride(
  override: Omit<TranslationOverride, 'id' | 'createdAt'>
): TranslationOverride {
  const db = getDatabase()
  const id = generateId()
  const now = new Date().toISOString()

  const stmt = db.prepare(`
    INSERT INTO translation_overrides (
      id, project_id, chapter_id, source_segment, original_translation,
      override_translation, scope, reason, created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  stmt.run(
    id,
    override.projectId,
    override.chapterId || null,
    override.sourceSegment,
    override.originalTranslation,
    override.overrideTranslation,
    override.scope,
    override.reason || null,
    now
  )

  return { id, ...override, createdAt: now }
}

/**
 * Get override for a source segment
 */
export function getOverride(
  sourceSegment: string,
  projectId: string,
  chapterId?: string
): TranslationOverride | null {
  const db = getDatabase()
  const params: unknown[] = [sourceSegment, projectId]

  // Priority: chapter > project > global
  let sql = `
    SELECT id, project_id, chapter_id, source_segment, original_translation,
           override_translation, scope, reason, created_at
    FROM translation_overrides
    WHERE source_segment = ? AND project_id = ?
  `

  if (chapterId) {
    sql += ' AND (chapter_id = ? OR chapter_id IS NULL)'
    params.push(chapterId)
  }

  sql += `
    ORDER BY
      CASE scope
        WHEN 'chapter' THEN 1
        WHEN 'project' THEN 2
        WHEN 'global' THEN 3
      END
    LIMIT 1
  `

  const row = db.prepare(sql).get(...params) as OverrideRow | undefined
  return row ? rowToOverride(row) : null
}

/**
 * List overrides for a project
 */
export function listOverrides(projectId: string, chapterId?: string): TranslationOverride[] {
  const db = getDatabase()

  let sql = `
    SELECT id, project_id, chapter_id, source_segment, original_translation,
           override_translation, scope, reason, created_at
    FROM translation_overrides
    WHERE project_id = ?
  `
  const params: unknown[] = [projectId]

  if (chapterId) {
    sql += ' AND (chapter_id = ? OR chapter_id IS NULL)'
    params.push(chapterId)
  }

  sql += ' ORDER BY created_at DESC'

  const rows = db.prepare(sql).all(...params) as OverrideRow[]
  return rows.map(rowToOverride)
}

/**
 * Update an override
 */
export function updateOverride(
  id: string,
  updates: Partial<Omit<TranslationOverride, 'id' | 'projectId' | 'createdAt'>>
): void {
  const db = getDatabase()

  const setClauses: string[] = []
  const values: unknown[] = []

  if (updates.chapterId !== undefined) {
    setClauses.push('chapter_id = ?')
    values.push(updates.chapterId || null)
  }
  if (updates.sourceSegment !== undefined) {
    setClauses.push('source_segment = ?')
    values.push(updates.sourceSegment)
  }
  if (updates.originalTranslation !== undefined) {
    setClauses.push('original_translation = ?')
    values.push(updates.originalTranslation)
  }
  if (updates.overrideTranslation !== undefined) {
    setClauses.push('override_translation = ?')
    values.push(updates.overrideTranslation)
  }
  if (updates.scope !== undefined) {
    setClauses.push('scope = ?')
    values.push(updates.scope)
  }
  if (updates.reason !== undefined) {
    setClauses.push('reason = ?')
    values.push(updates.reason || null)
  }

  if (setClauses.length === 0) return

  values.push(id)
  const stmt = db.prepare(`UPDATE translation_overrides SET ${setClauses.join(', ')} WHERE id = ?`)
  stmt.run(...values)
}

/**
 * Delete an override
 */
export function deleteOverride(id: string): void {
  const db = getDatabase()
  db.prepare('DELETE FROM translation_overrides WHERE id = ?').run(id)
}

// ============================================================================
// Internal helpers
// ============================================================================

interface MemoryRow {
  id: string
  source_hash: string
  source_text: string
  target_text: string
  provider_config_id: string
  model_id: string
  config_id: string | null
  project_id: string | null
  confidence: number
  manually_verified: number
  usage_count: number
  last_used_at: string | null
  created_at: string
}

interface OverrideRow {
  id: string
  project_id: string
  chapter_id: string | null
  source_segment: string
  original_translation: string
  override_translation: string
  scope: string
  reason: string | null
  created_at: string
}

function rowToMemoryEntry(row: MemoryRow): TranslationMemoryEntry {
  return {
    id: row.id,
    sourceHash: row.source_hash,
    sourceText: row.source_text,
    targetText: row.target_text,
    providerConfigId: row.provider_config_id,
    modelId: row.model_id,
    configId: row.config_id || undefined,
    projectId: row.project_id || undefined,
    confidence: row.confidence,
    manuallyVerified: row.manually_verified === 1,
    usageCount: row.usage_count,
    lastUsedAt: row.last_used_at || undefined,
    createdAt: row.created_at
  }
}

function rowToOverride(row: OverrideRow): TranslationOverride {
  return {
    id: row.id,
    projectId: row.project_id,
    chapterId: row.chapter_id || undefined,
    sourceSegment: row.source_segment,
    originalTranslation: row.original_translation,
    overrideTranslation: row.override_translation,
    scope: row.scope as 'chapter' | 'project' | 'global',
    reason: row.reason || undefined,
    createdAt: row.created_at
  }
}
