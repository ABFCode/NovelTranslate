import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import type { ZodType } from 'zod'
import { logger } from '../services/logger'

/**
 * Validate a value coming across the IPC boundary against a Zod schema.
 * Throws a descriptive error (surfaced to the renderer) if it doesn't match.
 *
 * Schemas may strip unknown keys — validation here is a gate, not a transform,
 * so the original value is returned for the handler to use as-is.
 */
export function validateInput<T>(schema: ZodType<T>, value: unknown, label: string): void {
  const result = schema.safeParse(value)
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('; ')
    throw new Error(`Invalid ${label}: ${issues}`)
  }
}

/**
 * Assert that an argument is a non-empty string (e.g. an entity id). Throws
 * otherwise. Cheap guard for the many id-keyed handlers that hit the database.
 */
export function assertNonEmptyString(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Invalid ${label}: expected a non-empty string`)
  }
}

/**
 * Wrapper for ipcMain.handle that provides consistent error logging.
 * Logs errors with the channel name for debugging, then re-throws
 * so the renderer receives the error.
 */
export function handleIpc<TArgs extends unknown[], T>(
  channel: string,
  handler: (...args: TArgs) => Promise<T> | T
): void {
  ipcMain.handle(channel, async (_event, ...args) => {
    try {
      return await handler(...(args as TArgs))
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
export function handleIpcWithEvent<TArgs extends unknown[], T>(
  channel: string,
  handler: (event: IpcMainInvokeEvent, ...args: TArgs) => Promise<T> | T
): void {
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      return await handler(event, ...(args as TArgs))
    } catch (error) {
      logger.error(
        `IPC ${channel} failed`,
        error instanceof Error ? error : new Error(String(error))
      )
      throw error
    }
  })
}
