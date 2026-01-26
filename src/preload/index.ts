import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type {
  Project,
  Chapter,
  ChapterContent,
  TranslationConfig,
  AppSettings,
  ProviderInfo,
  TranslationProgressEvent,
  SidecarStatusEvent,
} from '../shared/types'

// Type-safe IPC invoke wrapper
function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  return ipcRenderer.invoke(channel, ...args)
}

// Custom APIs for renderer - type-safe interface to main process
const api = {
  // =========================================================================
  // Project APIs
  // =========================================================================
  project: {
    create: (name: string, epubPath: string) =>
      invoke<Project>('project:create', name, epubPath),
    open: (id: string) => invoke<Project>('project:open', id),
    delete: (id: string) => invoke<void>('project:delete', id),
    list: () => invoke<Project[]>('project:list'),
    get: (id: string) => invoke<Project | null>('project:get', id),
    importEpub: (filePath: string) => invoke<Project>('project:import-epub', filePath),
  },

  // =========================================================================
  // Chapter APIs
  // =========================================================================
  chapter: {
    list: (projectId: string) => invoke<Chapter[]>('chapter:list', projectId),
    get: (id: string) => invoke<Chapter | null>('chapter:get', id),
    getContent: (id: string) => invoke<ChapterContent | null>('chapter:get-content', id),
    updateStatus: (id: string, status: string) =>
      invoke<void>('chapter:update-status', id, status),
  },

  // =========================================================================
  // Translation APIs
  // =========================================================================
  translation: {
    start: (projectId: string, chapterIds: string[], configId: string) =>
      invoke<void>('translation:start', projectId, chapterIds, configId),
    pause: (projectId: string) => invoke<void>('translation:pause', projectId),
    resume: (projectId: string) => invoke<void>('translation:resume', projectId),
    cancel: (projectId: string) => invoke<void>('translation:cancel', projectId),
  },

  // =========================================================================
  // Config APIs
  // =========================================================================
  config: {
    list: () => invoke<TranslationConfig[]>('config:list'),
    get: (id: string) => invoke<TranslationConfig | null>('config:get', id),
    save: (config: TranslationConfig) => invoke<TranslationConfig>('config:save', config),
    delete: (id: string) => invoke<void>('config:delete', id),
  },

  // =========================================================================
  // Settings APIs
  // =========================================================================
  settings: {
    get: () => invoke<AppSettings>('settings:get'),
    save: (settings: Partial<AppSettings>) => invoke<AppSettings>('settings:save', settings),
  },

  // =========================================================================
  // API Key APIs
  // =========================================================================
  apiKey: {
    get: (providerId: string) => invoke<string | null>('apikey:get', providerId),
    save: (providerId: string, key: string) => invoke<void>('apikey:save', providerId, key),
    delete: (providerId: string) => invoke<void>('apikey:delete', providerId),
    validate: (providerId: string, key: string) =>
      invoke<boolean>('apikey:validate', providerId, key),
  },

  // =========================================================================
  // Provider APIs
  // =========================================================================
  provider: {
    list: () => invoke<ProviderInfo[]>('provider:list'),
  },

  // =========================================================================
  // Sidecar APIs
  // =========================================================================
  sidecar: {
    health: () => invoke<boolean>('sidecar:health'),
  },

  // =========================================================================
  // Event Subscriptions
  // =========================================================================
  on: {
    translationProgress: (callback: (event: TranslationProgressEvent) => void) => {
      const handler = (_: unknown, data: TranslationProgressEvent) => callback(data)
      ipcRenderer.on('translation:progress', handler)
      return () => ipcRenderer.removeListener('translation:progress', handler)
    },
    sidecarStatus: (callback: (event: SidecarStatusEvent) => void) => {
      const handler = (_: unknown, data: SidecarStatusEvent) => callback(data)
      ipcRenderer.on('sidecar:status', handler)
      return () => ipcRenderer.removeListener('sidecar:status', handler)
    },
  },

  // =========================================================================
  // Utility APIs
  // =========================================================================
  ping: () => invoke<string>('ping'),
}

// Export type for use in renderer
export type Api = typeof api

// Use `contextBridge` APIs to expose Electron APIs to renderer
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
    console.log('[Preload] API exposed to renderer')
  } catch (error) {
    console.error('[Preload] Failed to expose API:', error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
  console.log('[Preload] API attached to window (non-isolated)')
}
