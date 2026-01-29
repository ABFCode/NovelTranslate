import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import { logger } from '../services/logger'

/**
 * Wrapper for ipcMain.handle that provides consistent error logging.
 * Logs errors with the channel name for debugging, then re-throws
 * so the renderer receives the error.
 */
export function handleIpc<T>(
  channel: string,
  handler: (...args: unknown[]) => Promise<T> | T
): void {
  ipcMain.handle(channel, async (_event, ...args) => {
    try {
      return await handler(...args)
    } catch (error) {
      logger.error(
        `IPC ${channel} failed`,
        error instanceof Error ? error : new Error(String(error))
      )
      throw error
    }
  })
}

/**
 * Wrapper for ipcMain.handle that passes the event to the handler.
 * Use this when you need access to event.sender (e.g., for BrowserWindow.fromWebContents).
 */
export function handleIpcWithEvent<T>(
  channel: string,
  handler: (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<T> | T
): void {
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      return await handler(event, ...args)
    } catch (error) {
      logger.error(
        `IPC ${channel} failed`,
        error instanceof Error ? error : new Error(String(error))
      )
      throw error
    }
  })
}
