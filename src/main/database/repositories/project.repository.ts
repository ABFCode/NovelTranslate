import { getDatabase, generateId } from '../index'
import type { Project, ProjectMetadata } from '../../../shared/types'

/**
 * Create a new project
 */
export function createProject(name: string, sourcePath?: string): Project {
  const db = getDatabase()
  const id = generateId()
  const now = new Date().toISOString()
  const metadata: ProjectMetadata = {
    totalChapters: 0,
    translatedChapters: 0,
  }

  const stmt = db.prepare(`
    INSERT INTO projects (id, name, source_path, created_at, updated_at, metadata_json)
    VALUES (?, ?, ?, ?, ?, ?)
  `)

  stmt.run(id, name, sourcePath || null, now, now, JSON.stringify(metadata))

  return {
    id,
    name,
    sourcePath: sourcePath || '',
    createdAt: now,
    updatedAt: now,
    metadata,
  }
}

/**
 * Get a project by ID
 */
export function getProject(id: string): Project | null {
  const db = getDatabase()
  const stmt = db.prepare(`
    SELECT id, name, source_path, created_at, updated_at, metadata_json
    FROM projects
    WHERE id = ?
  `)

  const row = stmt.get(id) as ProjectRow | undefined

  if (!row) {
    return null
  }

  return rowToProject(row)
}

/**
 * Get all projects, ordered by most recently updated
 */
export function listProjects(): Project[] {
  const db = getDatabase()
  const stmt = db.prepare(`
    SELECT id, name, source_path, created_at, updated_at, metadata_json
    FROM projects
    ORDER BY updated_at DESC
  `)

  const rows = stmt.all() as ProjectRow[]
  return rows.map(rowToProject)
}

/**
 * Update project metadata
 */
export function updateProjectMetadata(id: string, metadata: Partial<ProjectMetadata>): void {
  const db = getDatabase()
  const project = getProject(id)

  if (!project) {
    throw new Error(`Project not found: ${id}`)
  }

  const updatedMetadata = { ...project.metadata, ...metadata }
  const now = new Date().toISOString()

  const stmt = db.prepare(`
    UPDATE projects
    SET metadata_json = ?, updated_at = ?
    WHERE id = ?
  `)

  stmt.run(JSON.stringify(updatedMetadata), now, id)
}

/**
 * Update project name
 */
export function updateProjectName(id: string, name: string): void {
  const db = getDatabase()
  const now = new Date().toISOString()

  const stmt = db.prepare(`
    UPDATE projects
    SET name = ?, updated_at = ?
    WHERE id = ?
  `)

  stmt.run(name, now, id)
}

/**
 * Delete a project and all related data (cascades via foreign keys)
 */
export function deleteProject(id: string): void {
  const db = getDatabase()
  const stmt = db.prepare('DELETE FROM projects WHERE id = ?')
  stmt.run(id)
}

/**
 * Touch project (update the updated_at timestamp)
 */
export function touchProject(id: string): void {
  const db = getDatabase()
  const now = new Date().toISOString()
  const stmt = db.prepare('UPDATE projects SET updated_at = ? WHERE id = ?')
  stmt.run(now, id)
}

// ============================================================================
// Internal helpers
// ============================================================================

interface ProjectRow {
  id: string
  name: string
  source_path: string | null
  created_at: string
  updated_at: string
  metadata_json: string
}

function rowToProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    sourcePath: row.source_path || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    metadata: JSON.parse(row.metadata_json),
  }
}
