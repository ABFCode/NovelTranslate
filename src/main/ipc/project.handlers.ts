import { ipcMain, dialog } from 'electron'
import { basename } from 'path'
import {
  createProject,
  getProject,
  listProjects,
  deleteProject,
  updateProjectMetadata,
  createChaptersBulk,
  listChapters,
  getChapterContent,
} from '../database'
import { parseEpub, exportEpub, isSidecarConnected } from '../services/sidecar'
import { getMainWindow } from '../window'
import type { Project } from '../../shared/types'

/**
 * Register project-related IPC handlers
 */
export function registerProjectHandlers(): void {
  // Create a new project
  ipcMain.handle('project:create', async (_event, name: string, sourcePath?: string): Promise<Project> => {
    return createProject(name, sourcePath)
  })

  // Get a project by ID
  ipcMain.handle('project:get', async (_event, id: string): Promise<Project | null> => {
    return getProject(id)
  })

  // List all projects
  ipcMain.handle('project:list', async (): Promise<Project[]> => {
    return listProjects()
  })

  // Delete a project
  ipcMain.handle('project:delete', async (_event, id: string): Promise<void> => {
    deleteProject(id)
  })

  // Import EPUB
  ipcMain.handle('project:import-epub', async (_event, filePath?: string): Promise<Project | null> => {
    // If no file path provided, open file dialog
    if (!filePath) {
      const mainWindow = getMainWindow()
      if (!mainWindow) {
        throw new Error('No main window available')
      }

      const result = await dialog.showOpenDialog(mainWindow, {
        title: 'Import EPUB',
        filters: [{ name: 'EPUB Files', extensions: ['epub'] }],
        properties: ['openFile'],
      })

      if (result.canceled || result.filePaths.length === 0) {
        // User cancelled - return null instead of throwing
        return null
      }

      filePath = result.filePaths[0]
    }

    // Check if sidecar is running
    if (!isSidecarConnected()) {
      throw new Error('Go sidecar is not running. Please restart the application.')
    }

    // Parse the EPUB
    const epubResult = await parseEpub(filePath, (progress) => {
      // Send progress to renderer
      const mainWindow = getMainWindow()
      if (mainWindow) {
        mainWindow.webContents.send('epub:import-progress', progress)
      }
    })

    // Create project
    const projectName = epubResult.metadata.title || basename(filePath, '.epub')
    const project = createProject(projectName, filePath)

    // Create chapters
    const chapters = epubResult.chapters.map((ch) => ({
      spineIndex: ch.spineIndex,
      title: ch.title,
      sourceText: ch.content,
    }))

    createChaptersBulk(project.id, chapters)

    // Update project metadata
    updateProjectMetadata(project.id, {
      title: epubResult.metadata.title,
      author: epubResult.metadata.author,
      language: epubResult.metadata.language,
      description: epubResult.metadata.description,
      totalChapters: chapters.length,
      translatedChapters: 0,
    })

    // Return updated project
    return getProject(project.id)!
  })

  // Export project to EPUB
  ipcMain.handle('project:export-epub', async (_event, projectId: string): Promise<string> => {
    // Get project
    const project = getProject(projectId)
    if (!project) {
      throw new Error('Project not found')
    }

    // Check if sidecar is running
    if (!isSidecarConnected()) {
      throw new Error('Go sidecar is not running')
    }

    // Open save dialog
    const mainWindow = getMainWindow()
    if (!mainWindow) {
      throw new Error('No main window available')
    }

    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Export EPUB',
      defaultPath: `${project.name}_translated.epub`,
      filters: [{ name: 'EPUB Files', extensions: ['epub'] }],
    })

    if (result.canceled || !result.filePath) {
      throw new Error('Export cancelled')
    }

    // Get all translated chapters
    const chapters = listChapters(projectId)
    const exportChapters: Array<{ title: string; content: string }> = []

    for (const chapter of chapters) {
      const content = getChapterContent(chapter.id)
      if (content && content.translatedText) {
        exportChapters.push({
          title: chapter.title,
          content: content.translatedText,
        })
      }
    }

    if (exportChapters.length === 0) {
      throw new Error('No translated chapters to export')
    }

    // Export EPUB
    const exportResult = await exportEpub(
      result.filePath,
      {
        title: project.metadata.title || project.name,
        author: project.metadata.author || '',
        language: 'en',
        description: project.metadata.description || '',
        publisher: '',
        subjects: [],
      },
      exportChapters
    )

    return exportResult.filePath
  })

  console.log('[IPC] Project handlers registered')
}
