/**
 * Database schema definitions for NovelTranslate
 * 
 * Tables:
 * - projects: Store project metadata
 * - chapters: Store chapter metadata (lazy load content)
 * - chapter_content: Store actual text content (separate for performance)
 * - glossary_terms: Store translation glossary
 * - translation_configs: Store translation configurations
 * - translation_memory: Cache translations for reuse
 * - usage_logs: Track API usage and costs
 * - migrations: Track applied migrations
 */

export const SCHEMA_VERSION = 1

export const SCHEMA_SQL = `
-- Enable WAL mode for better concurrent read/write performance
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ============================================================================
-- Migrations tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS migrations (
  id INTEGER PRIMARY KEY,
  version INTEGER NOT NULL UNIQUE,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================================
-- Projects
-- ============================================================================
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  source_path TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  metadata_json TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_projects_updated ON projects(updated_at DESC);

-- ============================================================================
-- Chapters
-- ============================================================================
CREATE TABLE IF NOT EXISTS chapters (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  spine_index INTEGER NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'translating', 'translated', 'error', 'skipped')),
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_chapters_project_status ON chapters(project_id, status);
CREATE INDEX IF NOT EXISTS idx_chapters_project_index ON chapters(project_id, spine_index);

-- ============================================================================
-- Chapter Content (separate table for lazy loading)
-- ============================================================================
CREATE TABLE IF NOT EXISTS chapter_content (
  chapter_id TEXT PRIMARY KEY,
  source_text TEXT NOT NULL DEFAULT '',
  translated_text TEXT,
  FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
);

-- ============================================================================
-- FTS5 for full-text search across chapters
-- ============================================================================
CREATE VIRTUAL TABLE IF NOT EXISTS chapters_fts USING fts5(
  title,
  source_text,
  translated_text,
  content='chapter_content',
  content_rowid='rowid',
  tokenize='porter'
);

-- Triggers to keep FTS index in sync
CREATE TRIGGER IF NOT EXISTS chapters_fts_insert AFTER INSERT ON chapter_content BEGIN
  INSERT INTO chapters_fts(rowid, title, source_text, translated_text)
  SELECT c.rowid, ch.title, NEW.source_text, NEW.translated_text
  FROM chapter_content c
  JOIN chapters ch ON ch.id = c.chapter_id
  WHERE c.chapter_id = NEW.chapter_id;
END;

CREATE TRIGGER IF NOT EXISTS chapters_fts_update AFTER UPDATE ON chapter_content BEGIN
  DELETE FROM chapters_fts WHERE rowid = OLD.rowid;
  INSERT INTO chapters_fts(rowid, title, source_text, translated_text)
  SELECT c.rowid, ch.title, NEW.source_text, NEW.translated_text
  FROM chapter_content c
  JOIN chapters ch ON ch.id = c.chapter_id
  WHERE c.chapter_id = NEW.chapter_id;
END;

CREATE TRIGGER IF NOT EXISTS chapters_fts_delete AFTER DELETE ON chapter_content BEGIN
  DELETE FROM chapters_fts WHERE rowid = OLD.rowid;
END;

-- ============================================================================
-- Glossary Terms
-- ============================================================================
CREATE TABLE IF NOT EXISTS glossary_terms (
  id TEXT PRIMARY KEY,
  project_id TEXT,  -- NULL for global terms
  source_term TEXT NOT NULL,
  target_term TEXT NOT NULL,
  term_type TEXT NOT NULL DEFAULT 'other' CHECK(term_type IN ('name', 'place', 'skill', 'item', 'other')),
  context TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_glossary_project ON glossary_terms(project_id);
CREATE INDEX IF NOT EXISTS idx_glossary_source ON glossary_terms(source_term);

-- ============================================================================
-- Translation Configs
-- ============================================================================
CREATE TABLE IF NOT EXISTS translation_configs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  model_id TEXT NOT NULL,
  system_prompt TEXT NOT NULL DEFAULT '',
  user_prompt_template TEXT NOT NULL DEFAULT '',
  temperature REAL NOT NULL DEFAULT 0.7,
  max_tokens INTEGER,
  fallback_config_ids_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================================
-- Translation Memory
-- ============================================================================
CREATE TABLE IF NOT EXISTS translation_memory (
  id TEXT PRIMARY KEY,
  source_hash TEXT NOT NULL,
  source_text TEXT NOT NULL,
  target_text TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 1.0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_memory_hash ON translation_memory(source_hash);

-- ============================================================================
-- Usage Logs
-- ============================================================================
CREATE TABLE IF NOT EXISTS usage_logs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  chapter_id TEXT,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  tokens_in INTEGER NOT NULL,
  tokens_out INTEGER NOT NULL,
  cost_usd REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_usage_project ON usage_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_usage_created ON usage_logs(created_at DESC);

-- ============================================================================
-- App Settings (key-value store)
-- ============================================================================
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL
);
`
