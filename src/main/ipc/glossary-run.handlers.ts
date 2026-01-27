import { BrowserWindow, ipcMain } from 'electron'
import type { CostEstimate, GlossaryRunResult } from '../../shared/types'
import { glossaryRunService } from '../services/glossary-run.service'

/**
 * Register glossary run IPC handlers
 */
export function registerGlossaryRunHandlers(): void {
  ipcMain.handle('glossaryRun:getRecommendedModels', async () => {
    return glossaryRunService.getRecommendedModels()
  })

  ipcMain.handle(
    'glossaryRun:estimate',
    async (
      _event,
      projectId: string,
      chapterIds: string[],
      providerId: string,
      modelId: string
    ): Promise<CostEstimate> => {
      return glossaryRunService.estimateCost(projectId, chapterIds, providerId, modelId)
    }
  )

  ipcMain.handle(
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
        chapterIds,
        providerId,
        modelId,
        concurrency ?? 3,
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

  console.log('[IPC] Glossary run handlers registered')
}
