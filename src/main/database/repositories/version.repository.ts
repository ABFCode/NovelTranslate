import type { TranslationVersion } from '../../../shared/types'
import { generateId, getDatabase } from '../index'

/**
 * Archive the current translation before overwriting
 */
export function archiveTranslation(
  chapterId: string,
  translatedText: string,
  configId?: string,
  configName?: string,
  providerConfigId?: string,
  modelId?: string
): TranslationVersion {
  const db = getDatabase()
  const id = generateId()
  const now = new Date().toISOString()

  // Get the next version number
  const maxVersion = db
    .prepare(`
    SELECT MAX(version_number) as max_version
    FROM translation_versions
    WHERE chapter_id = ?
  `)
    .get(chapterId) as { max_version: number | null }

  const versionNumber = (maxVersion?.max_version || 0) + 1

  const stmt = db.prepare(`
    INSERT INTO translation_versions (
      id, chapter_id, translated_text, config_id, config_name,
      provider_config_id, model_id, version_number, created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  stmt.run(
    id,
    chapterId,
    translatedText,
    configId || null,
    configName || null,
    providerConfigId || null,
    modelId || null,
    versionNumber,
    now
  )

  return {
    id,
    chapterId,
    translatedText,
    configId,
    configName,
    providerConfigId,
    modelId,
    versionNumber,
    createdAt: now,
  }
}

/**
 * Get all versions for a chapter
 */
export function listTranslationVersions(chapterId: string): TranslationVersion[] {
  const db = getDatabase()
  const stmt = db.prepare(`
    SELECT id, chapter_id, translated_text, config_id, config_name,
           provider_config_id, model_id, version_number, created_at
    FROM translation_versions
    WHERE chapter_id = ?
    ORDER BY version_number DESC
  `)

  const rows = stmt.all(chapterId) as VersionRow[]
  return rows.map(rowToVersion)
}

/**
 * Get a specific version
 */
export function getTranslationVersion(id: string): TranslationVersion | null {
  const db = getDatabase()
  const stmt = db.prepare(`
    SELECT id, chapter_id, translated_text, config_id, config_name,
           provider_config_id, model_id, version_number, created_at
    FROM translation_versions
    WHERE id = ?
  `)

  const row = stmt.get(id) as VersionRow | undefined
  return row ? rowToVersion(row) : null
}

/**
 * Get the latest version for a chapter
 */
export function getLatestVersion(chapterId: string): TranslationVersion | null {
  const db = getDatabase()
  const stmt = db.prepare(`
    SELECT id, chapter_id, translated_text, config_id, config_name,
           provider_config_id, model_id, version_number, created_at
    FROM translation_versions
    WHERE chapter_id = ?
    ORDER BY version_number DESC
    LIMIT 1
  `)

  const row = stmt.get(chapterId) as VersionRow | undefined
  return row ? rowToVersion(row) : null
}

/**
 * Delete old versions, keeping only the N most recent
 */
export function pruneVersions(chapterId: string, keepCount: number = 10): number {
  const db = getDatabase()

  // Get IDs to delete
  const toDelete = db
    .prepare(`
    SELECT id FROM translation_versions
    WHERE chapter_id = ?
    ORDER BY version_number DESC
    LIMIT -1 OFFSET ?
  `)
    .all(chapterId, keepCount) as { id: string }[]

  if (toDelete.length === 0) return 0

  const deleteStmt = db.prepare('DELETE FROM translation_versions WHERE id = ?')
  const deleteMany = db.transaction((ids: string[]) => {
    for (const id of ids) {
      deleteStmt.run(id)
    }
    return ids.length
  })

  return deleteMany(toDelete.map((r) => r.id))
}

/**
 * Get version count for a chapter
 */
export function getVersionCount(chapterId: string): number {
  const db = getDatabase()
  const result = db
    .prepare(`
    SELECT COUNT(*) as count
    FROM translation_versions
    WHERE chapter_id = ?
  `)
    .get(chapterId) as { count: number }

  return result.count
}

// ============================================================================
// Internal helpers
// ============================================================================

interface VersionRow {
  id: string
  chapter_id: string
  translated_text: string
  config_id: string | null
  config_name: string | null
  provider_config_id: string | null
  model_id: string | null
  version_number: number
  created_at: string
}

function rowToVersion(row: VersionRow): TranslationVersion {
  return {
    id: row.id,
    chapterId: row.chapter_id,
    translatedText: row.translated_text,
    configId: row.config_id || undefined,
    configName: row.config_name || undefined,
    providerConfigId: row.provider_config_id || undefined,
    modelId: row.model_id || undefined,
    versionNumber: row.version_number,
    createdAt: row.created_at,
  }
}
