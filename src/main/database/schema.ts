/**
 * Database schema definitions for NovelTranslate
 *
 * Complete schema rebuild for Config Chains and Testing Center feature.
 *
 * Tables:
 * - migrations: Track applied migrations
 * - projects: Store project metadata
 * - chapters: Store chapter metadata (lazy load content)
 * - chapter_content: Store actual text content (separate for performance)
 * - chapters_fts: Full-text search index
 * - translation_configs: Store translation configurations
 * - config_fallbacks: Chain definitions with conditions
 * - config_snapshots: Config versioning for reproducibility
 * - project_configs: Project-specific config assignments
 * - project_budgets: Budget tracking per project
 * - api_keys: Multi-key support per provider
 * - prompt_templates: Pre-built prompt templates
 * - glossary_terms: Extended glossary with gender, aliases, confidence
 * - glossary_suggestions: AI-proposed terms pending review
 * - translation_memory: Extended cache with verification
 * - translation_overrides: Manual corrections
 * - test_runs: Testing Center run metadata
 * - test_results: Individual test results
 * - batch_test_chapters: Batch testing chapter associations
 * - retry_configs: Retry strategy configurations
 * - usage_logs: Track API usage and costs
 * - app_settings: Key-value store for settings
 */

export const SCHEMA_VERSION = 2

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
  source_language TEXT NOT NULL DEFAULT 'auto',
  target_language TEXT NOT NULL DEFAULT 'en',
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
  last_config_id TEXT,
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
  is_default BOOLEAN NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_configs_default ON translation_configs(is_default);

-- ============================================================================
-- Config Fallbacks (Chain Definitions)
-- ============================================================================
CREATE TABLE IF NOT EXISTS config_fallbacks (
  id TEXT PRIMARY KEY,
  config_id TEXT NOT NULL,
  fallback_config_id TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  condition_type TEXT NOT NULL DEFAULT 'any' 
    CHECK(condition_type IN ('any', 'content_block', 'rate_limit', 
      'timeout', 'auth_error', 'quota_exceeded', 'context_length', 'network_error')),
  condition_value TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (config_id) REFERENCES translation_configs(id) ON DELETE CASCADE,
  FOREIGN KEY (fallback_config_id) REFERENCES translation_configs(id) ON DELETE CASCADE,
  UNIQUE(config_id, fallback_config_id, condition_type)
);

CREATE INDEX IF NOT EXISTS idx_fallbacks_config ON config_fallbacks(config_id, priority);

-- ============================================================================
-- Config Snapshots (Versioning)
-- ============================================================================
CREATE TABLE IF NOT EXISTS config_snapshots (
  id TEXT PRIMARY KEY,
  config_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  name TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  model_id TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  user_prompt_template TEXT NOT NULL,
  temperature REAL NOT NULL,
  max_tokens INTEGER,
  reason TEXT NOT NULL CHECK(reason IN ('edit', 'test', 'translation')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (config_id) REFERENCES translation_configs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_snapshots_config ON config_snapshots(config_id, version DESC);

-- ============================================================================
-- Project-specific Config Assignments
-- ============================================================================
CREATE TABLE IF NOT EXISTS project_configs (
  project_id TEXT NOT NULL,
  config_id TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT 0,
  priority INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (config_id) REFERENCES translation_configs(id) ON DELETE CASCADE,
  PRIMARY KEY (project_id, config_id)
);

-- ============================================================================
-- Project Budgets
-- ============================================================================
CREATE TABLE IF NOT EXISTS project_budgets (
  project_id TEXT PRIMARY KEY,
  budget_usd REAL NOT NULL DEFAULT 0,
  spent_usd REAL NOT NULL DEFAULT 0,
  alert_threshold REAL NOT NULL DEFAULT 0.8,
  hard_limit BOOLEAN NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- ============================================================================
-- API Keys (Multi-key Support)
-- ============================================================================
CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL,
  key_encrypted TEXT NOT NULL,
  label TEXT,
  is_valid BOOLEAN NOT NULL DEFAULT 1,
  last_validated_at TEXT,
  last_error_at TEXT,
  last_error TEXT,
  request_count INTEGER NOT NULL DEFAULT 0,
  last_used_at TEXT,
  priority INTEGER NOT NULL DEFAULT 0,
  is_enabled BOOLEAN NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_api_keys_provider ON api_keys(provider_id, priority);

-- ============================================================================
-- Prompt Templates
-- ============================================================================
CREATE TABLE IF NOT EXISTS prompt_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'custom' 
    CHECK(category IN ('literal', 'natural', 'specialized', 'custom')),
  system_prompt TEXT NOT NULL,
  user_prompt_template TEXT NOT NULL,
  suggested_temperature REAL NOT NULL DEFAULT 0.7,
  suggested_max_tokens INTEGER,
  is_built_in BOOLEAN NOT NULL DEFAULT 0,
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================================
-- Glossary Terms (Extended)
-- ============================================================================
CREATE TABLE IF NOT EXISTS glossary_terms (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  source_term TEXT NOT NULL,
  target_term TEXT NOT NULL,
  term_type TEXT NOT NULL DEFAULT 'other' 
    CHECK(term_type IN ('name', 'place', 'skill', 'item', 'honorific', 'other')),
  gender TEXT CHECK(gender IN ('male', 'female', 'neutral', 'unknown')),
  pronouns TEXT,
  aliases_json TEXT NOT NULL DEFAULT '[]',
  context TEXT,
  notes TEXT,
  auto_generated BOOLEAN NOT NULL DEFAULT 0,
  confidence REAL NOT NULL DEFAULT 1.0,
  source_context TEXT,
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_glossary_project ON glossary_terms(project_id);
CREATE INDEX IF NOT EXISTS idx_glossary_source ON glossary_terms(source_term);

-- ============================================================================
-- Glossary Suggestions (AI-proposed terms)
-- ============================================================================
CREATE TABLE IF NOT EXISTS glossary_suggestions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  chapter_id TEXT,
  source_term TEXT NOT NULL,
  suggested_target TEXT NOT NULL,
  term_type TEXT NOT NULL DEFAULT 'other',
  gender TEXT CHECK(gender IN ('male', 'female', 'neutral', 'unknown')),
  confidence REAL NOT NULL DEFAULT 0.5,
  source_context TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' 
    CHECK(status IN ('pending', 'accepted', 'rejected', 'merged')),
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_suggestions_project_status ON glossary_suggestions(project_id, status);

-- ============================================================================
-- Translation Memory (Extended)
-- ============================================================================
CREATE TABLE IF NOT EXISTS translation_memory (
  id TEXT PRIMARY KEY,
  source_hash TEXT NOT NULL,
  source_text TEXT NOT NULL,
  target_text TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  model_id TEXT NOT NULL,
  config_id TEXT,
  project_id TEXT,
  confidence REAL NOT NULL DEFAULT 1.0,
  manually_verified BOOLEAN NOT NULL DEFAULT 0,
  usage_count INTEGER NOT NULL DEFAULT 0,
  last_used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (config_id) REFERENCES translation_configs(id) ON DELETE SET NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_memory_hash ON translation_memory(source_hash);
CREATE INDEX IF NOT EXISTS idx_memory_project ON translation_memory(project_id);

-- ============================================================================
-- Translation Overrides (Manual Corrections)
-- ============================================================================
CREATE TABLE IF NOT EXISTS translation_overrides (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  chapter_id TEXT,
  source_segment TEXT NOT NULL,
  original_translation TEXT NOT NULL,
  override_translation TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'chapter' CHECK(scope IN ('chapter', 'project', 'global')),
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_overrides_project ON translation_overrides(project_id);
CREATE INDEX IF NOT EXISTS idx_overrides_source ON translation_overrides(source_segment);

-- ============================================================================
-- Testing Center: Test Runs
-- ============================================================================
CREATE TABLE IF NOT EXISTS test_runs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sample_text TEXT NOT NULL,
  source_language TEXT NOT NULL DEFAULT 'auto',
  target_language TEXT NOT NULL DEFAULT 'en',
  test_type TEXT NOT NULL DEFAULT 'single' CHECK(test_type IN ('single', 'comparison', 'batch')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================================
-- Testing Center: Test Results
-- ============================================================================
CREATE TABLE IF NOT EXISTS test_results (
  id TEXT PRIMARY KEY,
  test_run_id TEXT NOT NULL,
  config_id TEXT,
  config_snapshot_id TEXT,
  config_name TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  model_id TEXT NOT NULL,
  result_text TEXT,
  tokens_in INTEGER NOT NULL DEFAULT 0,
  tokens_out INTEGER NOT NULL DEFAULT 0,
  cost_usd REAL NOT NULL DEFAULT 0,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  error_type TEXT,
  execution_path_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (test_run_id) REFERENCES test_runs(id) ON DELETE CASCADE,
  FOREIGN KEY (config_id) REFERENCES translation_configs(id) ON DELETE SET NULL,
  FOREIGN KEY (config_snapshot_id) REFERENCES config_snapshots(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_test_results_run ON test_results(test_run_id);

-- ============================================================================
-- Batch Test Chapters (for batch testing mode)
-- ============================================================================
CREATE TABLE IF NOT EXISTS batch_test_chapters (
  id TEXT PRIMARY KEY,
  test_run_id TEXT NOT NULL,
  chapter_id TEXT NOT NULL,
  result_id TEXT,
  FOREIGN KEY (test_run_id) REFERENCES test_runs(id) ON DELETE CASCADE,
  FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE,
  FOREIGN KEY (result_id) REFERENCES test_results(id) ON DELETE SET NULL
);

-- ============================================================================
-- Retry Configuration (per-config or global)
-- ============================================================================
CREATE TABLE IF NOT EXISTS retry_configs (
  id TEXT PRIMARY KEY,
  config_id TEXT,
  strategy TEXT NOT NULL DEFAULT 'exponential_jitter' 
    CHECK(strategy IN ('none', 'immediate', 'linear', 'exponential', 'exponential_jitter')),
  max_attempts INTEGER NOT NULL DEFAULT 3,
  base_delay_ms INTEGER NOT NULL DEFAULT 1000,
  max_delay_ms INTEGER NOT NULL DEFAULT 60000,
  jitter_factor REAL NOT NULL DEFAULT 0.2,
  retryable_errors_json TEXT NOT NULL DEFAULT '["rate_limit", "timeout", "network_error"]',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (config_id) REFERENCES translation_configs(id) ON DELETE CASCADE
);

-- ============================================================================
-- Usage Logs
-- ============================================================================
CREATE TABLE IF NOT EXISTS usage_logs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  chapter_id TEXT,
  config_id TEXT,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  tokens_in INTEGER NOT NULL,
  tokens_out INTEGER NOT NULL,
  cost_usd REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE SET NULL,
  FOREIGN KEY (config_id) REFERENCES translation_configs(id) ON DELETE SET NULL
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

/**
 * Seed data for built-in prompt templates
 */
export const SEED_PROMPT_TEMPLATES = [
  {
    id: 'template-literal',
    name: 'Literal Translation',
    description: 'Preserves original sentence structure with minimal interpretation. Good for technical or legal content.',
    category: 'literal',
    system_prompt: `You are a precise translator. Translate the text as literally as possible while maintaining grammatical correctness. Preserve the original sentence structure, word order, and phrasing when possible. Do not add interpretation or localize idioms.`,
    user_prompt_template: `Translate the following text from {{sourceLanguage}} to {{targetLanguage}}. Maintain literal accuracy.

Text to translate:
{{text}}`,
    suggested_temperature: 0.3,
    suggested_max_tokens: null,
    is_built_in: true
  },
  {
    id: 'template-natural',
    name: 'Natural/Localized',
    description: 'Adapts idioms and expressions to read naturally in the target language. Best for fiction and casual content.',
    category: 'natural',
    system_prompt: `You are a skilled literary translator. Translate the text to read naturally and fluently in the target language. Adapt idioms, expressions, and cultural references appropriately. Prioritize readability and natural flow over literal accuracy.`,
    user_prompt_template: `Translate the following text from {{sourceLanguage}} to {{targetLanguage}}. Make it read naturally and fluently.

Text to translate:
{{text}}`,
    suggested_temperature: 0.7,
    suggested_max_tokens: null,
    is_built_in: true
  },
  {
    id: 'template-honorifics',
    name: 'Preserve Honorifics',
    description: 'Keeps Japanese/Korean honorifics (-san, -sama, senpai, etc.) intact. Common for light novels and manga.',
    category: 'specialized',
    system_prompt: `You are a translator specializing in Japanese/Korean content. Preserve all honorifics in their original form (-san, -sama, -kun, -chan, -senpai, -sensei, etc.). Keep cultural terms that don't have good English equivalents. Translate naturally otherwise.

Common honorifics to preserve:
- -san: General polite suffix
- -sama: Very formal/respectful
- -kun: Familiar, often for males
- -chan: Affectionate, often for females/children
- -senpai: Senior/mentor
- -sensei: Teacher/master`,
    user_prompt_template: `Translate the following text from {{sourceLanguage}} to {{targetLanguage}}. Preserve all honorifics and cultural terms.

Text to translate:
{{text}}`,
    suggested_temperature: 0.6,
    suggested_max_tokens: null,
    is_built_in: true
  },
  {
    id: 'template-webnovel',
    name: 'Web Novel Style',
    description: 'Optimized for Chinese web novels (xianxia, xuanhuan). Handles cultivation terms and genre conventions.',
    category: 'specialized',
    system_prompt: `You are a translator specializing in Chinese web novels (xianxia, xuanhuan, wuxia). Handle cultivation-specific terminology appropriately:

- Keep or romanize cultivation realms/stages
- Translate technique/skill names descriptively when needed
- Preserve the dramatic tone and "face" culture elements
- Handle number-based naming conventions (Third Young Master, etc.)
- Maintain the epic/dramatic narrative style common in the genre

Common terms to handle consistently:
- 气/氣 (qi/chi) - life energy
- 丹田 (dantian) - energy center
- 修炼 (cultivation)
- 境界 (realm/level)`,
    user_prompt_template: `Translate the following Chinese web novel text to {{targetLanguage}}. Maintain the genre's dramatic style and handle cultivation terminology appropriately.

Text to translate:
{{text}}`,
    suggested_temperature: 0.7,
    suggested_max_tokens: null,
    is_built_in: true
  },
  {
    id: 'template-formal',
    name: 'Formal/Professional',
    description: 'Business-appropriate language with no slang or colloquialisms. Suitable for professional documents.',
    category: 'literal',
    system_prompt: `You are a professional translator for business and formal documents. Use formal, professional language throughout. Avoid slang, colloquialisms, and casual expressions. Maintain a neutral, authoritative tone.`,
    user_prompt_template: `Translate the following text from {{sourceLanguage}} to {{targetLanguage}}. Use formal, professional language.

Text to translate:
{{text}}`,
    suggested_temperature: 0.4,
    suggested_max_tokens: null,
    is_built_in: true
  }
]

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG = {
  id: 'default-retry-config',
  config_id: null,
  strategy: 'exponential_jitter',
  max_attempts: 3,
  base_delay_ms: 1000,
  max_delay_ms: 60000,
  jitter_factor: 0.2,
  retryable_errors_json: '["rate_limit", "timeout", "network_error"]'
}
