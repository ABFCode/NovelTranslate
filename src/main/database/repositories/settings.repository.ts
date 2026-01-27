import { getDatabase } from '../index'
import type { AppSettings } from '../../../shared/types'

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  uiMode: 'simple',
  defaultConfigId: undefined,
  defaultProviderId: undefined,
  defaultModelId: undefined,
  translationConcurrency: 3,
  autoSaveInterval: 30000, // 30 seconds
  keyRotationStrategy: 'priority',
  globalRetryConfigId: undefined,
  enableTranslationMemory: true,
  enableGlossaryInjection: true,
  showCostEstimates: true
}

/**
 * Get app settings
 */
export function getSettings(): AppSettings {
  const db = getDatabase()
  const stmt = db.prepare('SELECT value_json FROM app_settings WHERE key = ?')
  const row = stmt.get('settings') as { value_json: string } | undefined

  if (!row) {
    return DEFAULT_SETTINGS
  }

  const stored = JSON.parse(row.value_json)
  return { ...DEFAULT_SETTINGS, ...stored }
}

/**
 * Save app settings (partial update)
 */
export function saveSettings(updates: Partial<AppSettings>): AppSettings {
  const db = getDatabase()
  const current = getSettings()
  const updated = { ...current, ...updates }

  const stmt = db.prepare(`
    INSERT INTO app_settings (key, value_json)
    VALUES ('settings', ?)
    ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json
  `)

  stmt.run(JSON.stringify(updated))

  return updated
}

/**
 * Get a specific setting value
 */
export function getSetting<K extends keyof AppSettings>(key: K): AppSettings[K] {
  const settings = getSettings()
  return settings[key]
}

/**
 * Set a specific setting value
 */
export function setSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
  saveSettings({ [key]: value })
}

/**
 * Reset settings to defaults
 */
export function resetSettings(): AppSettings {
  const db = getDatabase()
  const stmt = db.prepare('DELETE FROM app_settings WHERE key = ?')
  stmt.run('settings')
  return DEFAULT_SETTINGS
}

/**
 * Get the default settings object (for reference)
 */
export function getDefaultSettings(): AppSettings {
  return { ...DEFAULT_SETTINGS }
}
