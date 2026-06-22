import type {
  ChainExecutionStep,
  ErrorType,
  TestResult,
  TestRun,
  TestType,
} from '../../../shared/types'
import { generateId, getDatabase } from '../index'

// ============================================================================
// Test Run CRUD
// ============================================================================

/**
 * Create a new test run
 */
export function createTestRun(
  name: string,
  sampleText: string,
  sourceLanguage: string,
  targetLanguage: string,
  testType: TestType
): TestRun {
  const db = getDatabase()
  const id = generateId()
  const now = new Date().toISOString()

  const stmt = db.prepare(`
    INSERT INTO test_runs (id, name, sample_text, source_language, target_language, test_type, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)

  stmt.run(id, name, sampleText, sourceLanguage, targetLanguage, testType, now)

  return {
    id,
    name,
    sampleText,
    sourceLanguage,
    targetLanguage,
    testType,
    createdAt: now,
  }
}

/**
 * Get a test run by ID
 */
export function getTestRun(id: string): TestRun | null {
  const db = getDatabase()
  const stmt = db.prepare(`
    SELECT id, name, sample_text, source_language, target_language, test_type, created_at
    FROM test_runs
    WHERE id = ?
  `)

  const row = stmt.get(id) as TestRunRow | undefined
  return row ? rowToTestRun(row) : null
}

/**
 * Get a test run with its results
 */
export function getTestRunWithResults(id: string): TestRun | null {
  const testRun = getTestRun(id)
  if (!testRun) return null

  testRun.results = getResultsForTestRun(id)
  return testRun
}

/**
 * List all test runs
 */
export function listTestRuns(limit = 50): TestRun[] {
  const db = getDatabase()
  const stmt = db.prepare(`
    SELECT id, name, sample_text, source_language, target_language, test_type, created_at
    FROM test_runs
    ORDER BY created_at DESC
    LIMIT ?
  `)

  const rows = stmt.all(limit) as TestRunRow[]
  return rows.map(rowToTestRun)
}

/**
 * Delete a test run
 */
export function deleteTestRun(id: string): void {
  const db = getDatabase()
  db.prepare('DELETE FROM test_runs WHERE id = ?').run(id)
}

// ============================================================================
// Test Result CRUD
// ============================================================================

/**
 * Create a test result
 */
export function createTestResult(
  testRunId: string,
  configId: string | null,
  configSnapshotId: string | null,
  configName: string,
  providerConfigId: string,
  modelId: string,
  resultText: string | null,
  tokensIn: number,
  tokensOut: number,
  costUsd: number,
  durationMs: number,
  error: string | null,
  errorType: ErrorType | null,
  executionPath: ChainExecutionStep[]
): TestResult {
  const db = getDatabase()
  const id = generateId()
  const now = new Date().toISOString()

  const stmt = db.prepare(`
    INSERT INTO test_results (
      id, test_run_id, config_id, config_snapshot_id, config_name, provider_config_id, model_id,
      result_text, tokens_in, tokens_out, cost_usd, duration_ms, error, error_type,
      execution_path_json, created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  stmt.run(
    id,
    testRunId,
    configId,
    configSnapshotId,
    configName,
    providerConfigId,
    modelId,
    resultText,
    tokensIn,
    tokensOut,
    costUsd,
    durationMs,
    error,
    errorType,
    JSON.stringify(executionPath),
    now
  )

  return {
    id,
    testRunId,
    configId: configId || undefined,
    configSnapshotId: configSnapshotId || undefined,
    configName,
    providerConfigId,
    modelId,
    resultText: resultText || undefined,
    tokensIn,
    tokensOut,
    costUsd,
    durationMs,
    error: error || undefined,
    errorType: errorType || undefined,
    executionPath,
    createdAt: now,
  }
}

/**
 * Get results for a test run
 */
export function getResultsForTestRun(testRunId: string): TestResult[] {
  const db = getDatabase()
  const stmt = db.prepare(`
    SELECT id, test_run_id, config_id, config_snapshot_id, config_name, provider_config_id, model_id,
           result_text, tokens_in, tokens_out, cost_usd, duration_ms, error, error_type,
           execution_path_json, created_at
    FROM test_results
    WHERE test_run_id = ?
    ORDER BY created_at ASC
  `)

  const rows = stmt.all(testRunId) as TestResultRow[]
  return rows.map(rowToTestResult)
}

/**
 * Get a specific test result
 */
export function getTestResult(id: string): TestResult | null {
  const db = getDatabase()
  const stmt = db.prepare(`
    SELECT id, test_run_id, config_id, config_snapshot_id, config_name, provider_config_id, model_id,
           result_text, tokens_in, tokens_out, cost_usd, duration_ms, error, error_type,
           execution_path_json, created_at
    FROM test_results
    WHERE id = ?
  `)

  const row = stmt.get(id) as TestResultRow | undefined
  return row ? rowToTestResult(row) : null
}

// ============================================================================
// Batch Test Chapters
// ============================================================================

/**
 * Add a chapter to a batch test
 */
export function addChapterToBatchTest(testRunId: string, chapterId: string): void {
  const db = getDatabase()
  const id = generateId()

  db.prepare(`
    INSERT INTO batch_test_chapters (id, test_run_id, chapter_id, result_id)
    VALUES (?, ?, ?, NULL)
  `).run(id, testRunId, chapterId)
}

/**
 * Link a result to a batch test chapter
 */
export function linkResultToBatchChapter(
  testRunId: string,
  chapterId: string,
  resultId: string
): void {
  const db = getDatabase()
  db.prepare(`
    UPDATE batch_test_chapters 
    SET result_id = ? 
    WHERE test_run_id = ? AND chapter_id = ?
  `).run(resultId, testRunId, chapterId)
}

/**
 * Get chapters for a batch test
 */
export function getBatchTestChapters(
  testRunId: string
): Array<{ chapterId: string; resultId?: string }> {
  const db = getDatabase()
  const rows = db
    .prepare(`
    SELECT chapter_id, result_id
    FROM batch_test_chapters
    WHERE test_run_id = ?
  `)
    .all(testRunId) as Array<{ chapter_id: string; result_id: string | null }>

  return rows.map((r) => ({
    chapterId: r.chapter_id,
    resultId: r.result_id || undefined,
  }))
}

// ============================================================================
// Statistics
// ============================================================================

/**
 * Get test statistics for a config
 */
export function getConfigTestStats(configId: string): {
  totalTests: number
  successRate: number
  avgDurationMs: number
  avgCostUsd: number
} {
  const db = getDatabase()
  const row = db
    .prepare(`
    SELECT 
      COUNT(*) as total_tests,
      AVG(CASE WHEN error IS NULL THEN 1.0 ELSE 0.0 END) as success_rate,
      AVG(duration_ms) as avg_duration_ms,
      AVG(cost_usd) as avg_cost_usd
    FROM test_results
    WHERE config_id = ?
  `)
    .get(configId) as {
    total_tests: number
    success_rate: number | null
    avg_duration_ms: number | null
    avg_cost_usd: number | null
  }

  return {
    totalTests: row.total_tests,
    successRate: row.success_rate ?? 0,
    avgDurationMs: row.avg_duration_ms ?? 0,
    avgCostUsd: row.avg_cost_usd ?? 0,
  }
}

// ============================================================================
// Internal helpers
// ============================================================================

interface TestRunRow {
  id: string
  name: string
  sample_text: string
  source_language: string
  target_language: string
  test_type: string
  created_at: string
}

interface TestResultRow {
  id: string
  test_run_id: string
  config_id: string | null
  config_snapshot_id: string | null
  config_name: string
  provider_config_id: string
  model_id: string
  result_text: string | null
  tokens_in: number
  tokens_out: number
  cost_usd: number
  duration_ms: number
  error: string | null
  error_type: string | null
  execution_path_json: string
  created_at: string
}

function rowToTestRun(row: TestRunRow): TestRun {
  return {
    id: row.id,
    name: row.name,
    sampleText: row.sample_text,
    sourceLanguage: row.source_language,
    targetLanguage: row.target_language,
    testType: row.test_type as TestType,
    createdAt: row.created_at,
  }
}

function rowToTestResult(row: TestResultRow): TestResult {
  return {
    id: row.id,
    testRunId: row.test_run_id,
    configId: row.config_id || undefined,
    configSnapshotId: row.config_snapshot_id || undefined,
    configName: row.config_name,
    providerConfigId: row.provider_config_id,
    modelId: row.model_id,
    resultText: row.result_text || undefined,
    tokensIn: row.tokens_in,
    tokensOut: row.tokens_out,
    costUsd: row.cost_usd,
    durationMs: row.duration_ms,
    error: row.error || undefined,
    errorType: (row.error_type as ErrorType) || undefined,
    executionPath: JSON.parse(row.execution_path_json),
    createdAt: row.created_at,
  }
}
