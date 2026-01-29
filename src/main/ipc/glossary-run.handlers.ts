import { BrowserWindow } from 'electron'
import type { CostEstimate, GlossaryRunResult } from '../../shared/types'
import { glossaryRunService } from '../services/glossary-run.service'
import { handleIpc, handleIpcWithEvent } from './utils'
import { logger } from '../services/logger'

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
      providerId: string,
      modelId: string
    ): Promise<CostEstimate> => {
      return glossaryRunService.estimateCost(projectId, chapterIds, providerId, modelId)
    }
  )

  handleIpcWithEvent(
    'glossaryRun:run',
    async (
      event,
      projectId: string,
      chapterIds: string[],
      providerId: string,
      modelId: string,
      concurrency?: number
    ): Promise<GlossaryRunResult> => {
      const window = BrowserWindow.fromWebContents(event.sender) || undefined

      return glossaryRunService.runExtraction(
        projectId,
        chapterIds as string[],
        providerId as string,
        modelId as string,
        (concurrency as number | undefined) ?? 3,
        (current, total, chapterId) => {
          window?.webContents.send('glossary:runProgress', {
            projectId,
            current,
            total,
            chapterId
          })
        }
      )
    }
  )

  logger.info('[IPC] Glossary run handlers registered')
}
