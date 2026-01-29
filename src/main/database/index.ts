import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync, unlinkSync } from 'fs'
import { SCHEMA_SQL, SCHEMA_VERSION, SEED_PROMPT_TEMPLATES, DEFAULT_RETRY_CONFIG } from './schema'
import { logger } from '../services/logger'

let db: Database.Database | null = null

/**
 * Get the database file path
 */
function getDatabasePath(): string {
  const userDataPath = app.getPath('userData')
  const dbDir = join(userDataPath, 'data')

  // Ensure directory exists
  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true })
  }

  return join(dbDir, 'noveltranslate.db')
}

/**
 * Check if database needs to be recreated due to schema version mismatch
 */
function shouldRecreateDatabase(dbPath: string): boolean {
  if (!existsSync(dbPath)) {
    return false // No existing DB, will create fresh
  }

  try {
    const testDb = new Database(dbPath, { readonly: true })
    const result = testDb
      .prepare('SELECT MAX(version) as version FROM migrations')
      .get() as { version: number } | undefined
    testDb.close()

    const currentVersion = result?.version ?? 0
    if (currentVersion < SCHEMA_VERSION) {
      logger.info(
        `[Database] Schema version mismatch: current=${currentVersion}, required=${SCHEMA_VERSION}`
      )
      logger.info('[Database] Recreating database (no user data to preserve)')
      return true
    }
    return false
  } catch {
    // Table doesn't exist or other error, recreate
    logger.info('[Database] Cannot read schema version, recreating database')
    return true
  }
}

/**
 * Seed the database with initial data
 */
function seedDatabase(database: Database.Database): void {
  // Check if templates already exist
  const existingTemplates = database
    .prepare('SELECT COUNT(*) as count FROM prompt_templates WHERE is_built_in = 1')
    .get() as { count: number }

  if (existingTemplates.count === 0) {
    logger.info('[Database] Seeding prompt templates...')
    const insertTemplate = database.prepare(`
      INSERT INTO prompt_templates (
        id, name, description, category, system_prompt, user_prompt_template,
        suggested_temperature, suggested_max_tokens, is_built_in, usage_count, created_at
      ) VALUES (
        @id, @name, @description, @category, @system_prompt, @user_prompt_template,
        @suggested_temperature, @suggested_max_tokens, @is_built_in, 0, datetime('now')
      )
    `)

    const insertMany = database.transaction((templates: typeof SEED_PROMPT_TEMPLATES) => {
      for (const template of templates) {
        insertTemplate.run({
          ...template,
          // better-sqlite3 only accepts numbers/strings/null; normalize booleans
          is_built_in: template.is_built_in ? 1 : 0
        })
      }
    })

    insertMany(SEED_PROMPT_TEMPLATES)
    logger.info(`[Database] Seeded ${SEED_PROMPT_TEMPLATES.length} prompt templates`)
  }

  // Seed default retry config
  const existingRetryConfig = database
    .prepare('SELECT COUNT(*) as count FROM retry_configs WHERE config_id IS NULL')
    .get() as { count: number }

  if (existingRetryConfig.count === 0) {
    logger.info('[Database] Seeding default retry config...')
    database
      .prepare(
        `
      INSERT INTO retry_configs (
        id, config_id, strategy, max_attempts, base_delay_ms, max_delay_ms,
        jitter_factor, retryable_errors_json, created_at
      ) VALUES (
        @id, @config_id, @strategy, @max_attempts, @base_delay_ms, @max_delay_ms,
        @jitter_factor, @retryable_errors_json, datetime('now')
      )
    `
      )
      .run(DEFAULT_RETRY_CONFIG)
    logger.info('[Database] Seeded default retry config')
  }
}

/**
 * Initialize the database connection and run migrations
 */
export function initDatabase(): Database.Database {
  if (db) {
    return db
  }

  const dbPath = getDatabasePath()
  logger.info(`[Database] Initializing at: ${dbPath}`)

  // Check if we need to recreate the database
  if (shouldRecreateDatabase(dbPath)) {
    try {
      unlinkSync(dbPath)
      // Also remove WAL and SHM files if they exist
      if (existsSync(`${dbPath}-wal`)) unlinkSync(`${dbPath}-wal`)
      if (existsSync(`${dbPath}-shm`)) unlinkSync(`${dbPath}-shm`)
      logger.info('[Database] Removed old database files')
    } catch (error) {
      logger.error('[Database] Error removing old database:', error instanceof Error ? error : new Error(String(error)))
    }
  }

  db = new Database(dbPath)

  // Enable foreign keys and WAL mode
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  // Run schema setup
  db.exec(SCHEMA_SQL)

  // Record migration
  const migrationStmt = db.prepare(`
    INSERT OR IGNORE INTO migrations (version, name)
    VALUES (?, ?)
  `)
  migrationStmt.run(SCHEMA_VERSION, 'config_chains_testing_center')

  // Seed initial data
  seedDatabase(db)

  logger.info(`[Database] Initialized successfully (version ${SCHEMA_VERSION})`)

  return db
}

/**
 * Get the database instance (must be initialized first)
 */
export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.')
  }
  return db
}

/**
 * Close the database connection
 */
export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
    logger.info('[Database] Connection closed')
  }
}

/**
 * Generate a unique ID (simple UUID v4 implementation)
 */
export function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

// ============================================================================
// Repository exports
// ============================================================================

export * from './repositories/project.repository'
export * from './repositories/chapter.repository'
export * from './repositories/config.repository'
export * from './repositories/settings.repository'
export * from './repositories/template.repository'
export * from './repositories/test.repository'
export * from './repositories/glossary.repository'
export * from './repositories/memory.repository'
export * from './repositories/budget.repository'
export * from './repositories/apikey.repository'
