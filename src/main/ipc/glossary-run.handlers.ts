import { BrowserWindow } from 'electron'
import type { CostEstimate, GlossaryRunResult } from '../../shared/types'
import { glossaryRunService } from '../services/glossary-run.service'
import { logger } from '../services/logger'
import { handleIpc, handleIpcWithEvent } from './utils'

/**
 * Register glossary run IPC handlers
 */
export function registerGlossaryRunHandlers(): void {
  handleIpc('glossaryRun:getRecommendedModels', () => {
    return glossaryRunService.getRecommendedModels()
  })

  handleIpc(
    'glossaryRun:estimate',
    (
      projectId: string,
      chapterIds: string[],
      providerConfigId: string,
      modelId: string
    ): Promise<CostEstimate> => {
      return glossaryRunService.estimateCost(projectId, chapterIds, providerConfigId, modelId)
    }
  )

  handleIpcWithEvent(
    'glossaryRun:run',
    async (
      event,
      projectId: string,
      chapterIds: string[],
      providerConfigId: string,
      modelId: string,
      concurrency?: number
    ): Promise<GlossaryRunResult> => {
      const window = BrowserWindow.fromWebContents(event.sender) || undefined

      return glossaryRunService.runExtraction(
        projectId,
        chapterIds as string[],
        providerConfigId as string,
        modelId as string,
        (concurrency as number | undefined) ?? 3,
        (current, total, chapterId) => {
          window?.webContents.send('glossary:runProgress', {
            projectId,
            current,
            total,
            chapterId,
          })
        }
      )
    }
  )

  logger.info('[IPC] Glossary run handlers registered')
}
