/**
 * Structured Logger Service
 *
 * Provides consistent logging with correlation IDs for chain execution tracking.
 */

import { appendFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  correlationId?: string
  context?: Record<string, unknown>
  error?: {
    name: string
    message: string
    stack?: string
  }
}

interface LoggerOptions {
  minLevel?: LogLevel
  enableConsole?: boolean
  enableFile?: boolean
  maxFileSizeMb?: number
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

/**
 * Structured Logger class
 */
export class Logger {
  private minLevel: LogLevel = 'info'
  private enableConsole = true
  private enableFile = false
  private maxFileSizeMb = 10
  private logFilePath: string
  private correlationId?: string

  constructor(options: LoggerOptions = {}) {
    this.minLevel = options.minLevel ?? 'info'
    this.enableConsole = options.enableConsole ?? true
    this.enableFile = options.enableFile ?? false
    this.maxFileSizeMb = options.maxFileSizeMb ?? 10

    // Set up log file path
    const logsDir = join(app.getPath('userData'), 'logs')
    if (!existsSync(logsDir)) {
      mkdirSync(logsDir, { recursive: true })
    }
    this.logFilePath = join(logsDir, 'noveltranslate.log')
  }

  /**
   * Set the minimum log level
   */
  setLevel(level: LogLevel): void {
    this.minLevel = level
  }

  /**
   * Enable or disable file logging
   */
  setFileLogging(enabled: boolean): void {
    this.enableFile = enabled
  }

  /**
   * Create a child logger with a correlation ID
   */
  child(correlationId: string): Logger {
    const childLogger = new Logger({
      minLevel: this.minLevel,
      enableConsole: this.enableConsole,
      enableFile: this.enableFile,
      maxFileSizeMb: this.maxFileSizeMb,
    })
    childLogger.correlationId = correlationId
    return childLogger
  }

  /**
   * Log at debug level
   */
  debug(message: string, context?: Record<string, unknown>): void {
    this.log('debug', message, context)
  }

  /**
   * Log at info level
   */
  info(message: string, context?: Record<string, unknown>): void {
    this.log('info', message, context)
  }

  /**
   * Log at warn level
   */
  warn(message: string, context?: Record<string, unknown>): void {
    this.log('warn', message, context)
  }

  /**
   * Log at error level
   */
  error(message: string, error?: Error, context?: Record<string, unknown>): void {
    this.log('error', message, context, error)
  }

  /**
   * Log chain execution start
   */
  chainStart(configId: string, sourceLength: number): void {
    this.info('Chain execution started', {
      configId,
      sourceLength,
      stage: 'chain_start',
    })
  }

  /**
   * Log chain step
   */
  chainStep(
    configId: string,
    step: number,
    action: 'attempt' | 'retry' | 'fallback' | 'success' | 'failure',
    details?: Record<string, unknown>
  ): void {
    this.info(`Chain step: ${action}`, {
      configId,
      step,
      action,
      stage: 'chain_step',
      ...details,
    })
  }

  /**
   * Log chain execution end
   */
  chainEnd(configId: string, success: boolean, durationMs: number, finalConfigId?: string): void {
    this.info('Chain execution completed', {
      configId,
      success,
      durationMs,
      finalConfigId,
      stage: 'chain_end',
    })
  }

  /**
   * Log API call
   */
  apiCall(
    providerConfigId: string,
    modelId: string,
    inputTokens: number,
    outputTokens: number,
    durationMs: number,
    success: boolean
  ): void {
    this.info('API call', {
      providerConfigId,
      modelId,
      inputTokens,
      outputTokens,
      durationMs,
      success,
      stage: 'api_call',
    })
  }

  /**
   * Log cost
   */
  cost(providerConfigId: string, modelId: string, costUsd: number): void {
    this.info('Cost incurred', {
      providerConfigId,
      modelId,
      costUsd,
      stage: 'cost',
    })
  }

  /**
   * Export logs to a file
   */
  exportLogs(outputPath: string, fromDate?: Date): void {
    // Read existing log file and filter by date if needed
    // For now, just copy the log file
    if (existsSync(this.logFilePath)) {
      const { readFileSync } = require('node:fs')
      const content = readFileSync(this.logFilePath, 'utf-8')

      if (fromDate) {
        const lines = content.split('\n')
        const filtered = lines.filter((line) => {
          try {
            const entry = JSON.parse(line) as LogEntry
            return new Date(entry.timestamp) >= fromDate
          } catch {
            return false
          }
        })
        writeFileSync(outputPath, filtered.join('\n'))
      } else {
        writeFileSync(outputPath, content)
      }
    }
  }

  /**
   * Clear log file
   */
  clearLogs(): void {
    if (existsSync(this.logFilePath)) {
      writeFileSync(this.logFilePath, '')
    }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private log(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>,
    error?: Error
  ): void {
    // Check if we should log at this level
    if (LOG_LEVELS[level] < LOG_LEVELS[this.minLevel]) {
      return
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      correlationId: this.correlationId,
      context,
    }

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      }
    }

    // Console output
    if (this.enableConsole) {
      this.writeToConsole(entry)
    }

    // File output
    if (this.enableFile) {
      this.writeToFile(entry)
    }
  }

  private writeToConsole(entry: LogEntry): void {
    const prefix = entry.correlationId ? `[${entry.correlationId}]` : ''
    const contextStr = entry.context ? ` ${JSON.stringify(entry.context)}` : ''

    switch (entry.level) {
      case 'debug':
        console.debug(`[DEBUG]${prefix} ${entry.message}${contextStr}`)
        break
      case 'info':
        console.log(`[INFO]${prefix} ${entry.message}${contextStr}`)
        break
      case 'warn':
        console.warn(`[WARN]${prefix} ${entry.message}${contextStr}`)
        break
      case 'error':
        console.error(`[ERROR]${prefix} ${entry.message}${contextStr}`)
        if (entry.error) {
          console.error(entry.error.stack || entry.error.message)
        }
        break
    }
  }

  private writeToFile(entry: LogEntry): void {
    try {
      const line = `${JSON.stringify(entry)}\n`
      appendFileSync(this.logFilePath, line)

      // Check file size and rotate if needed
      this.rotateIfNeeded()
    } catch (error) {
      console.error('[Logger] Failed to write to file:', error)
    }
  }

  private rotateIfNeeded(): void {
    try {
      const { statSync } = require('node:fs')
      const stats = statSync(this.logFilePath)
      const sizeMb = stats.size / (1024 * 1024)

      if (sizeMb > this.maxFileSizeMb) {
        // Rename current log file with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
        const rotatedPath = this.logFilePath.replace('.log', `-${timestamp}.log`)
        const { renameSync } = require('node:fs')
        renameSync(this.logFilePath, rotatedPath)
      }
    } catch {
      // Ignore rotation errors
    }
  }
}

/**
 * Generate a unique correlation ID
 */
export function generateCorrelationId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

// Default logger instance
export const logger = new Logger({
  minLevel: 'info',
  enableConsole: true,
  enableFile: false,
})
