import { BrowserWindow } from 'electron'
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
import { handleIpc, handleIpcWithEvent } from './utils'
import { logger } from '../services/logger'
import type { TestRun, CostEstimate } from '../../shared/types'

/**
 * Register test-related IPC handlers (Testing Center)
 */
export function registerTestHandlers(): void {
  // ============================================================================
  // Test Run Management
  // ============================================================================

  // List test runs
  handleIpc('test:list', (limit?: number): TestRun[] => {
    return listTestRuns(limit)
  })

  // Get a test run
  handleIpc('test:get', (id: string): TestRun | null => {
    return getTestRun(id)
  })

  // Get a test run with results
  handleIpc('test:getWithResults', (id: string): TestRun | null => {
    return getTestRunWithResults(id)
  })

  // Delete a test run
  handleIpc('test:delete', (id: string): void => {
    deleteTestRun(id)
  })

  // Get test statistics for a config
  handleIpc(
    'test:getConfigStats',
    (configId: string): {
      totalTests: number
      successRate: number
      avgDurationMs: number
      avgCostUsd: number
    } => {
      return getConfigTestStats(configId)
    }
  )

  // ============================================================================
  // Single Test
  // ============================================================================

  handleIpcWithEvent(
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
      const config = getConfig(configId as string)

      if (!config) {
        throw new Error(`Config not found: ${configId}`)
      }

      // Get API key
      const apiKey = await keyManager.getKey(config.providerConfigId)
      if (!apiKey) {
        throw new Error(`No API key for provider: ${config.providerConfigId}`)
      }

      // Create the test run
      const testRun = createTestRun(
        name as string,
        sampleText as string,
        sourceLanguage as string,
        targetLanguage as string,
        'single'
      )

      // Create config snapshot for reproducibility
      const snapshot = createConfigSnapshot(configId as string, 'test')

      // Execute the translation
      const startTime = Date.now()

      try {
        const result = await executeChain({
          configId: configId as string,
          sourceText: sampleText as string,
          sourceLanguage: sourceLanguage as string,
          targetLanguage: targetLanguage as string,
          apiKey,
          useMemory: false,
          useGlossary: false,
          createSnapshot: false,
          window
        })

        // Create test result
        createTestResult(
          testRun.id,
          configId as string,
          snapshot.id,
          config.name,
          config.providerConfigId,
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
          configId as string,
          snapshot.id,
          config.name,
          config.providerConfigId,
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

  handleIpcWithEvent(
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
      const testRun = createTestRun(
        name as string,
        sampleText as string,
        sourceLanguage as string,
        targetLanguage as string,
        'comparison'
      )

      // Run each config
      for (const cfgId of configIds as string[]) {
        const config = getConfig(cfgId)
        if (!config) {
          createTestResult(
            testRun.id,
            cfgId,
            null,
            'Unknown Config',
            '',
            '',
            null,
            0,
            0,
            0,
            0,
            `Config not found: ${cfgId}`,
            'unknown',
            []
          )
          continue
        }

        const apiKey = await keyManager.getKey(config.providerConfigId)
        if (!apiKey) {
          createTestResult(
            testRun.id,
            cfgId,
            null,
            config.name,
            config.providerConfigId,
            config.modelId,
            null,
            0,
            0,
            0,
            0,
            `No API key for provider: ${config.providerConfigId}`,
            'auth_error',
            []
          )
          continue
        }

        // Create snapshot
        const snapshot = createConfigSnapshot(cfgId, 'test')

        const startTime = Date.now()

        try {
          const result = await executeChain({
            configId: cfgId,
            sourceText: sampleText as string,
            sourceLanguage: sourceLanguage as string,
            targetLanguage: targetLanguage as string,
            apiKey,
            useMemory: false,
            useGlossary: false,
            window
          })

          createTestResult(
            testRun.id,
            cfgId,
            snapshot.id,
            config.name,
            config.providerConfigId,
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
            cfgId,
            snapshot.id,
            config.name,
            config.providerConfigId,
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

  handleIpcWithEvent(
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
      const config = getConfig(configId as string)

      if (!config) {
        throw new Error(`Config not found: ${configId}`)
      }

      const apiKey = await keyManager.getKey(config.providerConfigId)
      if (!apiKey) {
        throw new Error(`No API key for provider: ${config.providerConfigId}`)
      }

      const chapters = chapterTexts as Array<{ chapterId: string; text: string }>

      // Create the batch test run
      const testRun = createTestRun(
        name as string,
        chapters.map((c) => c.text).join('\n\n---\n\n'),
        sourceLanguage as string,
        targetLanguage as string,
        'batch'
      )

      // Add chapters to batch
      for (const chapter of chapters) {
        addChapterToBatchTest(testRun.id, chapter.chapterId)
      }

      // Create snapshot
      const snapshot = createConfigSnapshot(configId as string, 'test')

      // Run each chapter
      for (let i = 0; i < chapters.length; i++) {
        const chapter = chapters[i]

        // Emit progress
        window?.webContents.send('test:batchProgress', {
          testRunId: testRun.id,
          current: i + 1,
          total: chapters.length,
          chapterId: chapter.chapterId
        })

        const startTime = Date.now()

        try {
          const result = await executeChain({
            configId: configId as string,
            sourceText: chapter.text,
            sourceLanguage: sourceLanguage as string,
            targetLanguage: targetLanguage as string,
            apiKey,
            useMemory: false,
            useGlossary: false,
            window
          })

          const testResult = createTestResult(
            testRun.id,
            configId as string,
            snapshot.id,
            config.name,
            config.providerConfigId,
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
            configId as string,
            snapshot.id,
            config.name,
            config.providerConfigId,
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

  handleIpc('test:estimateCost', (text: string, configId: string): CostEstimate => {
    return estimateChainCost(text, configId)
  })

  handleIpc(
    'test:estimateSingleCost',
    (
      text: string,
      configId: string
    ): { inputTokens: number; outputTokens: number; costUsd: number; formatted: string } => {
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

  logger.info('[IPC] Test handlers registered')
}
