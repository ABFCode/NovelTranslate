import { ipcMain, BrowserWindow } from 'electron'
import {
  createTestRun,
  getTestRun,
  getTestRunWithResults,
  listTestRuns,
  deleteTestRun,
  createTestResult,
  addChapterToBatchTest,
  linkResultToBatchChapter,
  getConfigTestStats
} from '../database/repositories/test.repository'
import { getConfig, createConfigSnapshot } from '../database'
import { executeChain } from '../services/chain-executor'
import { estimateSingleCost, estimateChainCost, formatCost } from '../services/cost-estimator'
import { keyManager } from '../services/key-manager'
import type { TestRun, CostEstimate } from '../../shared/types'

/**
 * Register test-related IPC handlers (Testing Center)
 */
export function registerTestHandlers(): void {
  // ============================================================================
  // Test Run Management
  // ============================================================================

  // List test runs
  ipcMain.handle('test:list', async (_event, limit?: number): Promise<TestRun[]> => {
    return listTestRuns(limit)
  })

  // Get a test run
  ipcMain.handle('test:get', async (_event, id: string): Promise<TestRun | null> => {
    return getTestRun(id)
  })

  // Get a test run with results
  ipcMain.handle('test:getWithResults', async (_event, id: string): Promise<TestRun | null> => {
    return getTestRunWithResults(id)
  })

  // Delete a test run
  ipcMain.handle('test:delete', async (_event, id: string): Promise<void> => {
    deleteTestRun(id)
  })

  // Get test statistics for a config
  ipcMain.handle(
    'test:getConfigStats',
    async (
      _event,
      configId: string
    ): Promise<{
      totalTests: number
      successRate: number
      avgDurationMs: number
      avgCostUsd: number
    }> => {
      return getConfigTestStats(configId)
    }
  )

  // ============================================================================
  // Single Test
  // ============================================================================

  ipcMain.handle(
    'test:runSingle',
    async (
      event,
      name: string,
      sampleText: string,
      configId: string,
      sourceLanguage: string,
      targetLanguage: string
    ): Promise<TestRun> => {
      const window = BrowserWindow.fromWebContents(event.sender) || undefined
      const config = getConfig(configId)

      if (!config) {
        throw new Error(`Config not found: ${configId}`)
      }

      // Get API key
      const apiKey = await keyManager.getKey(config.providerId)
      if (!apiKey) {
        throw new Error(`No API key for provider: ${config.providerId}`)
      }

      // Create the test run
      const testRun = createTestRun(name, sampleText, sourceLanguage, targetLanguage, 'single')

      // Create config snapshot for reproducibility
      const snapshot = createConfigSnapshot(configId, 'test')

      // Execute the translation
      const startTime = Date.now()

      try {
        const result = await executeChain({
          configId,
          sourceText: sampleText,
          sourceLanguage,
          targetLanguage,
          apiKey,
          useMemory: false,
          useGlossary: false,
          createSnapshot: false,
          window
        })

        // Create test result
        createTestResult(
          testRun.id,
          configId,
          snapshot.id,
          config.name,
          config.providerId,
          config.modelId,
          result.translatedText || null,
          result.tokensUsed.input,
          result.tokensUsed.output,
          result.totalCostUsd,
          Date.now() - startTime,
          result.success ? null : result.finalError || 'Unknown error',
          result.success ? null : result.finalErrorType || null,
          result.executionPath
        )
      } catch (error) {
        createTestResult(
          testRun.id,
          configId,
          snapshot.id,
          config.name,
          config.providerId,
          config.modelId,
          null,
          0,
          0,
          0,
          Date.now() - startTime,
          String(error),
          'unknown',
          []
        )
      }

      return getTestRunWithResults(testRun.id)!
    }
  )

  // ============================================================================
  // Comparison Test (A/B Testing)
  // ============================================================================

  ipcMain.handle(
    'test:runComparison',
    async (
      event,
      name: string,
      sampleText: string,
      configIds: string[],
      sourceLanguage: string,
      targetLanguage: string
    ): Promise<TestRun> => {
      const window = BrowserWindow.fromWebContents(event.sender) || undefined

      // Create the test run
      const testRun = createTestRun(name, sampleText, sourceLanguage, targetLanguage, 'comparison')

      // Run each config
      for (const configId of configIds) {
        const config = getConfig(configId)
        if (!config) {
          createTestResult(
            testRun.id,
            configId,
            null,
            'Unknown Config',
            '',
            '',
            null,
            0,
            0,
            0,
            0,
            `Config not found: ${configId}`,
            'unknown',
            []
          )
          continue
        }

        const apiKey = await keyManager.getKey(config.providerId)
        if (!apiKey) {
          createTestResult(
            testRun.id,
            configId,
            null,
            config.name,
            config.providerId,
            config.modelId,
            null,
            0,
            0,
            0,
            0,
            `No API key for provider: ${config.providerId}`,
            'auth_error',
            []
          )
          continue
        }

        // Create snapshot
        const snapshot = createConfigSnapshot(configId, 'test')

        const startTime = Date.now()

        try {
          const result = await executeChain({
            configId,
            sourceText: sampleText,
            sourceLanguage,
            targetLanguage,
            apiKey,
            useMemory: false,
            useGlossary: false,
            window
          })

          createTestResult(
            testRun.id,
            configId,
            snapshot.id,
            config.name,
            config.providerId,
            config.modelId,
            result.translatedText || null,
            result.tokensUsed.input,
            result.tokensUsed.output,
            result.totalCostUsd,
            Date.now() - startTime,
            result.success ? null : result.finalError || null,
            result.success ? null : result.finalErrorType || null,
            result.executionPath
          )
        } catch (error) {
          createTestResult(
            testRun.id,
            configId,
            snapshot.id,
            config.name,
            config.providerId,
            config.modelId,
            null,
            0,
            0,
            0,
            Date.now() - startTime,
            String(error),
            'unknown',
            []
          )
        }
      }

      return getTestRunWithResults(testRun.id)!
    }
  )

  // ============================================================================
  // Batch Test (Multiple Chapters)
  // ============================================================================

  ipcMain.handle(
    'test:runBatch',
    async (
      event,
      name: string,
      chapterTexts: Array<{ chapterId: string; text: string }>,
      configId: string,
      sourceLanguage: string,
      targetLanguage: string
    ): Promise<TestRun> => {
      const window = BrowserWindow.fromWebContents(event.sender) || undefined
      const config = getConfig(configId)

      if (!config) {
        throw new Error(`Config not found: ${configId}`)
      }

      const apiKey = await keyManager.getKey(config.providerId)
      if (!apiKey) {
        throw new Error(`No API key for provider: ${config.providerId}`)
      }

      // Create the batch test run
      const testRun = createTestRun(
        name,
        chapterTexts.map((c) => c.text).join('\n\n---\n\n'),
        sourceLanguage,
        targetLanguage,
        'batch'
      )

      // Add chapters to batch
      for (const chapter of chapterTexts) {
        addChapterToBatchTest(testRun.id, chapter.chapterId)
      }

      // Create snapshot
      const snapshot = createConfigSnapshot(configId, 'test')

      // Run each chapter
      for (let i = 0; i < chapterTexts.length; i++) {
        const chapter = chapterTexts[i]

        // Emit progress
        window?.webContents.send('test:batchProgress', {
          testRunId: testRun.id,
          current: i + 1,
          total: chapterTexts.length,
          chapterId: chapter.chapterId
        })

        const startTime = Date.now()

        try {
          const result = await executeChain({
            configId,
            sourceText: chapter.text,
            sourceLanguage,
            targetLanguage,
            apiKey,
            useMemory: false,
            useGlossary: false,
            window
          })

          const testResult = createTestResult(
            testRun.id,
            configId,
            snapshot.id,
            config.name,
            config.providerId,
            config.modelId,
            result.translatedText || null,
            result.tokensUsed.input,
            result.tokensUsed.output,
            result.totalCostUsd,
            Date.now() - startTime,
            result.success ? null : result.finalError || null,
            result.success ? null : result.finalErrorType || null,
            result.executionPath
          )

          linkResultToBatchChapter(testRun.id, chapter.chapterId, testResult.id)
        } catch (error) {
          const testResult = createTestResult(
            testRun.id,
            configId,
            snapshot.id,
            config.name,
            config.providerId,
            config.modelId,
            null,
            0,
            0,
            0,
            Date.now() - startTime,
            String(error),
            'unknown',
            []
          )

          linkResultToBatchChapter(testRun.id, chapter.chapterId, testResult.id)
        }
      }

      return getTestRunWithResults(testRun.id)!
    }
  )

  // ============================================================================
  // Cost Estimation
  // ============================================================================

  ipcMain.handle(
    'test:estimateCost',
    async (_event, text: string, configId: string): Promise<CostEstimate> => {
      return estimateChainCost(text, configId)
    }
  )

  ipcMain.handle(
    'test:estimateSingleCost',
    async (
      _event,
      text: string,
      configId: string
    ): Promise<{ inputTokens: number; outputTokens: number; costUsd: number; formatted: string }> => {
      const config = getConfig(configId)
      if (!config) {
        throw new Error(`Config not found: ${configId}`)
      }

      const estimate = estimateSingleCost(text, config)
      return {
        ...estimate,
        formatted: formatCost(estimate.costUsd)
      }
    }
  )

  console.log('[IPC] Test handlers registered')
}
