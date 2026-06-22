import { getDatabase, generateId } from '../index'
import type { Chapter, ChapterContent, ChapterStatus } from '../../../shared/types'

/**
 * Create a new chapter
 */
export function createChapter(
  projectId: string,
  spineIndex: number,
  title: string,
  sourceText: string
): Chapter {
  const db = getDatabase()
  const id = generateId()
  const now = new Date().toISOString()

  // Insert chapter metadata
  const chapterStmt = db.prepare(`
    INSERT INTO chapters (id, project_id, spine_index, title, status, created_at)
    VALUES (?, ?, ?, ?, 'pending', ?)
  `)
  chapterStmt.run(id, projectId, spineIndex, title, now)

  // Insert chapter content
  const contentStmt = db.prepare(`
    INSERT INTO chapter_content (chapter_id, source_text, translated_text)
    VALUES (?, ?, NULL)
  `)
  contentStmt.run(id, sourceText)

  return {
    id,
    projectId,
    spineIndex,
    title,
    status: 'pending',
    createdAt: now,
  }
}

/**
 * Bulk create chapters (more efficient for imports)
 */
export function createChaptersBulk(
  projectId: string,
  chapters: Array<{ spineIndex: number; title: string; sourceText: string }>
): Chapter[] {
  const db = getDatabase()
  const now = new Date().toISOString()

  const chapterStmt = db.prepare(`
    INSERT INTO chapters (id, project_id, spine_index, title, status, created_at)
    VALUES (?, ?, ?, ?, 'pending', ?)
  `)

  const contentStmt = db.prepare(`
    INSERT INTO chapter_content (chapter_id, source_text, translated_text)
    VALUES (?, ?, NULL)
  `)

  const insertMany = db.transaction((items: typeof chapters) => {
    const results: Chapter[] = []

    for (const item of items) {
      const id = generateId()
      chapterStmt.run(id, projectId, item.spineIndex, item.title, now)
      contentStmt.run(id, item.sourceText)

      results.push({
        id,
        projectId,
        spineIndex: item.spineIndex,
        title: item.title,
        status: 'pending',
        createdAt: now,
      })
    }

    return results
  })

  return insertMany(chapters)
}

/**
 * Get a chapter by ID
 */
export function getChapter(id: string): Chapter | null {
  const db = getDatabase()
  const stmt = db.prepare(`
    SELECT id, project_id, spine_index, title, status, error_message, created_at
    FROM chapters
    WHERE id = ?
  `)

  const row = stmt.get(id) as ChapterRow | undefined
  return row ? rowToChapter(row) : null
}

/**
 * Get all chapters for a project
 */
export function listChapters(projectId: string): Chapter[] {
  const db = getDatabase()
  const stmt = db.prepare(`
    SELECT id, project_id, spine_index, title, status, error_message, created_at
    FROM chapters
    WHERE project_id = ?
    ORDER BY spine_index ASC
  `)

  const rows = stmt.all(projectId) as ChapterRow[]
  return rows.map(rowToChapter)
}

/**
 * Get chapter content
 */
export function getChapterContent(chapterId: string): ChapterContent | null {
  const db = getDatabase()
  const stmt = db.prepare(`
    SELECT chapter_id, source_text, translated_text
    FROM chapter_content
    WHERE chapter_id = ?
  `)

  const row = stmt.get(chapterId) as ChapterContentRow | undefined

  if (!row) {
    return null
  }

  return {
    chapterId: row.chapter_id,
    sourceText: row.source_text,
    translatedText: row.translated_text || undefined,
  }
}

/**
 * Update chapter status
 */
export function updateChapterStatus(
  id: string,
  status: ChapterStatus,
  errorMessage?: string
): void {
  const db = getDatabase()
  const stmt = db.prepare(`
    UPDATE chapters
    SET status = ?, error_message = ?
    WHERE id = ?
  `)
  stmt.run(status, errorMessage || null, id)
}

/**
 * Update chapter translation
 */
export function updateChapterTranslation(chapterId: string, translatedText: string): void {
  const db = getDatabase()
  const stmt = db.prepare(`
    UPDATE chapter_content
    SET translated_text = ?
    WHERE chapter_id = ?
  `)
  stmt.run(translatedText, chapterId)
}

/**
 * Update chapter title
 */
export function updateChapterTitle(id: string, title: string): void {
  const db = getDatabase()
  const stmt = db.prepare('UPDATE chapters SET title = ? WHERE id = ?')
  stmt.run(title, id)
}

/**
 * Bulk update chapter titles
 */
export function updateChapterTitlesBulk(updates: Array<{ id: string; title: string }>): void {
  const db = getDatabase()
  const stmt = db.prepare('UPDATE chapters SET title = ? WHERE id = ?')

  const updateMany = db.transaction((items: typeof updates) => {
    for (const item of items) {
      stmt.run(item.title, item.id)
    }
  })

  updateMany(updates)
}

/**
 * Get chapter statistics for a project
 */
export function getChapterStats(projectId: string): {
  total: number
  pending: number
  translating: number
  translated: number
  error: number
  skipped: number
} {
  const db = getDatabase()
  const stmt = db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'translating' THEN 1 ELSE 0 END) as translating,
      SUM(CASE WHEN status = 'translated' THEN 1 ELSE 0 END) as translated,
      SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error,
      SUM(CASE WHEN status = 'skipped' THEN 1 ELSE 0 END) as skipped
    FROM chapters
    WHERE project_id = ?
  `)

  const row = stmt.get(projectId) as {
    total: number
    pending: number
    translating: number
    translated: number
    error: number
    skipped: number
  }

  return row
}

/**
 * Clear translation for a chapter (reset to pending)
 */
export function clearChapterTranslation(chapterId: string): void {
  const db = getDatabase()

  // Reset status to pending
  db.prepare(`
    UPDATE chapters
    SET status = 'pending', error_message = NULL
    WHERE id = ?
  `).run(chapterId)

  // Clear translated text
  db.prepare(`
    UPDATE chapter_content
    SET translated_text = NULL
    WHERE chapter_id = ?
  `).run(chapterId)
}

/**
 * Clear translations for multiple chapters (batch)
 */
export function clearChapterTranslationsBulk(chapterIds: string[]): number {
  const db = getDatabase()

  const updateChapter = db.prepare(`
    UPDATE chapters
    SET status = 'pending', error_message = NULL
    WHERE id = ?
  `)

  const clearContent = db.prepare(`
    UPDATE chapter_content
    SET translated_text = NULL
    WHERE chapter_id = ?
  `)

  const clearMany = db.transaction((ids: string[]) => {
    let count = 0
    for (const id of ids) {
      updateChapter.run(id)
      clearContent.run(id)
      count++
    }
    return count
  })

  return clearMany(chapterIds)
}

// ============================================================================
// Internal helpers
// ============================================================================

interface ChapterRow {
  id: string
  project_id: string
  spine_index: number
  title: string
  status: ChapterStatus
  error_message: string | null
  created_at: string
}

interface ChapterContentRow {
  chapter_id: string
  source_text: string
  translated_text: string | null
}

function rowToChapter(row: ChapterRow): Chapter {
  return {
    id: row.id,
    projectId: row.project_id,
    spineIndex: row.spine_index,
    title: row.title,
    status: row.status,
    createdAt: row.created_at,
    errorMessage: row.error_message || undefined,
  }
}
