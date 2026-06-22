import type { UsageStats } from '../../../shared/types'
import { generateId, getDatabase } from '../index'

export interface RecordUsageParams {
  projectId: string
  chapterId?: string
  configId?: string
  providerConfigId: string
  modelId: string
  tokensIn: number
  tokensOut: number
  costUsd: number
}

/**
 * Record a single API call's token/cost usage.
 */
export function recordUsage(params: RecordUsageParams): void {
  const db = getDatabase()
  db.prepare(`
    INSERT INTO usage_logs (
      id, project_id, chapter_id, config_id, provider_config_id, model_id,
      tokens_in, tokens_out, cost_usd, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(
    generateId(),
    params.projectId,
    params.chapterId ?? null,
    params.configId ?? null,
    params.providerConfigId,
    params.modelId,
    params.tokensIn,
    params.tokensOut,
    params.costUsd
  )
}

interface TotalsRow {
  total_cost: number | null
  total_in: number | null
  total_out: number | null
  call_count: number
}

interface ByModelRow {
  provider_config_id: string
  model_id: string
  cost_usd: number
  tokens_in: number
  tokens_out: number
  call_count: number
}

/**
 * Aggregate usage stats, optionally scoped to a single project.
 */
export function getUsageStats(projectId?: string): UsageStats {
  const db = getDatabase()
  const where = projectId ? 'WHERE project_id = ?' : ''
  const args = projectId ? [projectId] : []

  const totals = db
    .prepare(`
      SELECT
        SUM(cost_usd) AS total_cost,
        SUM(tokens_in) AS total_in,
        SUM(tokens_out) AS total_out,
        COUNT(*) AS call_count
      FROM usage_logs ${where}
    `)
    .get(...args) as TotalsRow

  const byModel = db
    .prepare(`
      SELECT
        provider_config_id,
        model_id,
        SUM(cost_usd) AS cost_usd,
        SUM(tokens_in) AS tokens_in,
        SUM(tokens_out) AS tokens_out,
        COUNT(*) AS call_count
      FROM usage_logs ${where}
      GROUP BY provider_config_id, model_id
      ORDER BY cost_usd DESC
    `)
    .all(...args) as ByModelRow[]

  return {
    totalCostUsd: totals.total_cost ?? 0,
    totalTokensIn: totals.total_in ?? 0,
    totalTokensOut: totals.total_out ?? 0,
    callCount: totals.call_count,
    byModel: byModel.map((row) => ({
      providerConfigId: row.provider_config_id,
      modelId: row.model_id,
      costUsd: row.cost_usd,
      tokensIn: row.tokens_in,
      tokensOut: row.tokens_out,
      callCount: row.call_count,
    })),
  }
}
