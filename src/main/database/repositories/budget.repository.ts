import type { ProjectBudget } from '../../../shared/types'
import { getDatabase } from '../index'

// ============================================================================
// Project Budget CRUD
// ============================================================================

/**
 * Get the budget for a project
 */
export function getProjectBudget(projectId: string): ProjectBudget | null {
  const db = getDatabase()
  const stmt = db.prepare(`
    SELECT project_id, budget_usd, spent_usd, alert_threshold, hard_limit, created_at, updated_at
    FROM project_budgets
    WHERE project_id = ?
  `)

  const row = stmt.get(projectId) as BudgetRow | undefined
  return row ? rowToBudget(row) : null
}

/**
 * Create or update a project budget
 */
export function setProjectBudget(
  projectId: string,
  budgetUsd: number,
  alertThreshold = 0.8,
  hardLimit = false
): ProjectBudget {
  const db = getDatabase()
  const now = new Date().toISOString()

  const existing = getProjectBudget(projectId)

  if (existing) {
    db.prepare(`
      UPDATE project_budgets 
      SET budget_usd = ?, alert_threshold = ?, hard_limit = ?, updated_at = ?
      WHERE project_id = ?
    `).run(budgetUsd, alertThreshold, hardLimit ? 1 : 0, now, projectId)

    return { ...existing, budgetUsd, alertThreshold, hardLimit, updatedAt: now }
  }

  db.prepare(`
    INSERT INTO project_budgets (project_id, budget_usd, spent_usd, alert_threshold, hard_limit, created_at, updated_at)
    VALUES (?, ?, 0, ?, ?, ?, ?)
  `).run(projectId, budgetUsd, alertThreshold, hardLimit ? 1 : 0, now, now)

  return {
    projectId,
    budgetUsd,
    spentUsd: 0,
    alertThreshold,
    hardLimit,
    createdAt: now,
    updatedAt: now,
  }
}

/**
 * Record spending against a project budget
 */
export function recordSpending(projectId: string, amountUsd: number): void {
  const db = getDatabase()
  const now = new Date().toISOString()

  // Create budget if it doesn't exist
  const budget = getProjectBudget(projectId)
  if (!budget) {
    db.prepare(`
      INSERT INTO project_budgets (project_id, budget_usd, spent_usd, alert_threshold, hard_limit, created_at, updated_at)
      VALUES (?, 0, ?, 0.8, 0, ?, ?)
    `).run(projectId, amountUsd, now, now)
  } else {
    db.prepare(`
      UPDATE project_budgets 
      SET spent_usd = spent_usd + ?, updated_at = ?
      WHERE project_id = ?
    `).run(amountUsd, now, projectId)
  }
}

/**
 * Check if a project is within budget for an estimated cost
 */
export function checkBudget(
  projectId: string,
  estimatedCostUsd: number
): { allowed: boolean; warning?: string; remaining?: number } {
  const budget = getProjectBudget(projectId)

  if (!budget || budget.budgetUsd === 0) {
    return { allowed: true } // No budget set
  }

  const projectedSpent = budget.spentUsd + estimatedCostUsd
  const utilizationRatio = projectedSpent / budget.budgetUsd
  const remaining = budget.budgetUsd - budget.spentUsd

  if (utilizationRatio >= 1 && budget.hardLimit) {
    return {
      allowed: false,
      warning: `Budget exceeded: $${budget.spentUsd.toFixed(2)} / $${budget.budgetUsd.toFixed(2)}`,
      remaining,
    }
  }

  if (utilizationRatio >= budget.alertThreshold) {
    return {
      allowed: true,
      warning: `Approaching budget limit: ${(utilizationRatio * 100).toFixed(0)}% used`,
      remaining,
    }
  }

  return { allowed: true, remaining }
}

/**
 * Reset spending for a project (start of new billing period)
 */
export function resetSpending(projectId: string): void {
  const db = getDatabase()
  const now = new Date().toISOString()

  db.prepare(`
    UPDATE project_budgets 
    SET spent_usd = 0, updated_at = ?
    WHERE project_id = ?
  `).run(now, projectId)
}

/**
 * Delete a project budget
 */
export function deleteProjectBudget(projectId: string): void {
  const db = getDatabase()
  db.prepare('DELETE FROM project_budgets WHERE project_id = ?').run(projectId)
}

/**
 * Get all projects with budgets
 */
export function listProjectBudgets(): ProjectBudget[] {
  const db = getDatabase()
  const stmt = db.prepare(`
    SELECT project_id, budget_usd, spent_usd, alert_threshold, hard_limit, created_at, updated_at
    FROM project_budgets
    ORDER BY updated_at DESC
  `)

  const rows = stmt.all() as BudgetRow[]
  return rows.map(rowToBudget)
}

/**
 * Get projects approaching or over budget
 */
export function getProjectsNearBudget(): Array<ProjectBudget & { utilizationRatio: number }> {
  const db = getDatabase()
  const stmt = db.prepare(`
    SELECT project_id, budget_usd, spent_usd, alert_threshold, hard_limit, created_at, updated_at,
           CASE WHEN budget_usd > 0 THEN spent_usd / budget_usd ELSE 0 END as utilization_ratio
    FROM project_budgets
    WHERE budget_usd > 0 AND spent_usd / budget_usd >= alert_threshold
    ORDER BY utilization_ratio DESC
  `)

  const rows = stmt.all() as (BudgetRow & { utilization_ratio: number })[]
  return rows.map((row) => ({
    ...rowToBudget(row),
    utilizationRatio: row.utilization_ratio,
  }))
}

// ============================================================================
// Internal helpers
// ============================================================================

interface BudgetRow {
  project_id: string
  budget_usd: number
  spent_usd: number
  alert_threshold: number
  hard_limit: number
  created_at: string
  updated_at: string
}

function rowToBudget(row: BudgetRow): ProjectBudget {
  return {
    projectId: row.project_id,
    budgetUsd: row.budget_usd,
    spentUsd: row.spent_usd,
    alertThreshold: row.alert_threshold,
    hardLimit: row.hard_limit === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
