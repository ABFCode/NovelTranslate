import { ipcMain } from 'electron'
import {
  getConfig,
  listConfigs,
  createConfig,
  updateConfig,
  deleteConfig,
} from '../database'
import type { TranslationConfig } from '../../shared/types'

/**
 * Register config-related IPC handlers
 */
export function registerConfigHandlers(): void {
  // List all configs
  ipcMain.handle('config:list', async (): Promise<TranslationConfig[]> => {
    return listConfigs()
  })

  // Get a config by ID
  ipcMain.handle('config:get', async (_event, id: string): Promise<TranslationConfig | null> => {
    return getConfig(id)
  })

  // Save a config (create or update)
  ipcMain.handle(
    'config:save',
    async (_event, config: TranslationConfig): Promise<TranslationConfig> => {
      const existing = getConfig(config.id)

      if (existing) {
        updateConfig(config.id, config)
        return config
      } else {
        return createConfig(config)
      }
    }
  )

  // Delete a config
  ipcMain.handle('config:delete', async (_event, id: string): Promise<void> => {
    deleteConfig(id)
  })

  console.log('[IPC] Config handlers registered')
}
