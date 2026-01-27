import { getDatabase, generateId } from '../index'
import type { PromptTemplate, TemplateCategory } from '../../../shared/types'

// ============================================================================
// Prompt Template CRUD
// ============================================================================

/**
 * Get all prompt templates
 */
export function listTemplates(): PromptTemplate[] {
  const db = getDatabase()
  const stmt = db.prepare(`
    SELECT id, name, description, category, system_prompt, user_prompt_template,
           suggested_temperature, suggested_max_tokens, is_built_in, usage_count, created_at
    FROM prompt_templates
    ORDER BY is_built_in DESC, usage_count DESC, name ASC
  `)

  const rows = stmt.all() as TemplateRow[]
  return rows.map(rowToTemplate)
}

/**
 * Get templates by category
 */
export function listTemplatesByCategory(category: TemplateCategory): PromptTemplate[] {
  const db = getDatabase()
  const stmt = db.prepare(`
    SELECT id, name, description, category, system_prompt, user_prompt_template,
           suggested_temperature, suggested_max_tokens, is_built_in, usage_count, created_at
    FROM prompt_templates
    WHERE category = ?
    ORDER BY is_built_in DESC, usage_count DESC, name ASC
  `)

  const rows = stmt.all(category) as TemplateRow[]
  return rows.map(rowToTemplate)
}

/**
 * Get a template by ID
 */
export function getTemplate(id: string): PromptTemplate | null {
  const db = getDatabase()
  const stmt = db.prepare(`
    SELECT id, name, description, category, system_prompt, user_prompt_template,
           suggested_temperature, suggested_max_tokens, is_built_in, usage_count, created_at
    FROM prompt_templates
    WHERE id = ?
  `)

  const row = stmt.get(id) as TemplateRow | undefined
  return row ? rowToTemplate(row) : null
}

/**
 * Create a new template
 */
export function createTemplate(
  template: Omit<PromptTemplate, 'id' | 'isBuiltIn' | 'usageCount' | 'createdAt'>
): PromptTemplate {
  const db = getDatabase()
  const id = generateId()
  const now = new Date().toISOString()

  const stmt = db.prepare(`
    INSERT INTO prompt_templates (
      id, name, description, category, system_prompt, user_prompt_template,
      suggested_temperature, suggested_max_tokens, is_built_in, usage_count, created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?)
  `)

  stmt.run(
    id,
    template.name,
    template.description || null,
    template.category,
    template.systemPrompt,
    template.userPromptTemplate,
    template.suggestedTemperature,
    template.suggestedMaxTokens || null,
    now
  )

  return {
    id,
    ...template,
    isBuiltIn: false,
    usageCount: 0,
    createdAt: now
  }
}

/**
 * Update a template (cannot update built-in templates)
 */
export function updateTemplate(
  id: string,
  updates: Partial<Omit<PromptTemplate, 'id' | 'isBuiltIn' | 'usageCount' | 'createdAt'>>
): void {
  const db = getDatabase()
  const existing = getTemplate(id)

  if (!existing) {
    throw new Error(`Template not found: ${id}`)
  }

  if (existing.isBuiltIn) {
    throw new Error('Cannot update built-in templates')
  }

  const setClauses: string[] = []
  const values: unknown[] = []

  if (updates.name !== undefined) {
    setClauses.push('name = ?')
    values.push(updates.name)
  }
  if (updates.description !== undefined) {
    setClauses.push('description = ?')
    values.push(updates.description || null)
  }
  if (updates.category !== undefined) {
    setClauses.push('category = ?')
    values.push(updates.category)
  }
  if (updates.systemPrompt !== undefined) {
    setClauses.push('system_prompt = ?')
    values.push(updates.systemPrompt)
  }
  if (updates.userPromptTemplate !== undefined) {
    setClauses.push('user_prompt_template = ?')
    values.push(updates.userPromptTemplate)
  }
  if (updates.suggestedTemperature !== undefined) {
    setClauses.push('suggested_temperature = ?')
    values.push(updates.suggestedTemperature)
  }
  if (updates.suggestedMaxTokens !== undefined) {
    setClauses.push('suggested_max_tokens = ?')
    values.push(updates.suggestedMaxTokens || null)
  }

  if (setClauses.length === 0) return

  values.push(id)
  const stmt = db.prepare(`UPDATE prompt_templates SET ${setClauses.join(', ')} WHERE id = ?`)
  stmt.run(...values)
}

/**
 * Delete a template (cannot delete built-in templates)
 */
export function deleteTemplate(id: string): void {
  const db = getDatabase()
  const existing = getTemplate(id)

  if (!existing) {
    throw new Error(`Template not found: ${id}`)
  }

  if (existing.isBuiltIn) {
    throw new Error('Cannot delete built-in templates')
  }

  db.prepare('DELETE FROM prompt_templates WHERE id = ?').run(id)
}

/**
 * Increment the usage count for a template
 */
export function incrementTemplateUsage(id: string): void {
  const db = getDatabase()
  db.prepare('UPDATE prompt_templates SET usage_count = usage_count + 1 WHERE id = ?').run(id)
}

/**
 * Clone a template (creates a new custom template based on an existing one)
 */
export function cloneTemplate(id: string, newName: string): PromptTemplate {
  const template = getTemplate(id)
  if (!template) {
    throw new Error(`Template not found: ${id}`)
  }

  return createTemplate({
    name: newName,
    description: template.description ? `Based on: ${template.name}` : undefined,
    category: 'custom',
    systemPrompt: template.systemPrompt,
    userPromptTemplate: template.userPromptTemplate,
    suggestedTemperature: template.suggestedTemperature,
    suggestedMaxTokens: template.suggestedMaxTokens
  })
}

// ============================================================================
// Internal helpers
// ============================================================================

interface TemplateRow {
  id: string
  name: string
  description: string | null
  category: string
  system_prompt: string
  user_prompt_template: string
  suggested_temperature: number
  suggested_max_tokens: number | null
  is_built_in: number
  usage_count: number
  created_at: string
}

function rowToTemplate(row: TemplateRow): PromptTemplate {
  return {
    id: row.id,
    name: row.name,
    description: row.description || undefined,
    category: row.category as TemplateCategory,
    systemPrompt: row.system_prompt,
    userPromptTemplate: row.user_prompt_template,
    suggestedTemperature: row.suggested_temperature,
    suggestedMaxTokens: row.suggested_max_tokens || undefined,
    isBuiltIn: row.is_built_in === 1,
    usageCount: row.usage_count,
    createdAt: row.created_at
  }
}
