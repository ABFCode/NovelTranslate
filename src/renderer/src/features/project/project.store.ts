import { create } from 'zustand'
import type { Project, Chapter, TranslationProgressEvent, ChainFallbackEvent } from '@shared/types'

interface ProjectState {
  // Current project
  currentProject: Project | null
  chapters: Chapter[]
  isLoading: boolean
  error: string | null

  // Translation state
  isTranslating: boolean
  isPaused: boolean
  translationProgress: TranslationProgressEvent | null
  lastFallbackEvent: ChainFallbackEvent | null

  // Recent projects list
  recentProjects: Project[]

  // Actions
  setCurrentProject: (project: Project | null) => void
  setChapters: (chapters: Chapter[]) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  setRecentProjects: (projects: Project[]) => void
  addRecentProject: (project: Project) => void

  // Translation actions
  setTranslating: (translating: boolean) => void
  setPaused: (paused: boolean) => void
  updateTranslationProgress: (progress: TranslationProgressEvent) => void
  updateChapterStatus: (chapterId: string, status: Chapter['status']) => void

  // Async actions (call IPC)
  loadProjects: () => Promise<void>
  loadProject: (id: string) => Promise<void>
  createProject: (name: string, sourcePath?: string) => Promise<Project>
  deleteProject: (id: string) => Promise<void>
  startTranslation: (projectId: string, chapterIds: string[], configId?: string) => Promise<void>
  pauseTranslation: (projectId: string) => Promise<void>
  resumeTranslation: (projectId: string) => Promise<void>
  cancelTranslation: (projectId: string) => Promise<void>

  // Event subscriptions
  subscribeToEvents: () => () => void
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  // Initial state
  currentProject: null,
  chapters: [],
  isLoading: false,
  error: null,
  recentProjects: [],

  // Translation state
  isTranslating: false,
  isPaused: false,
  translationProgress: null,
  lastFallbackEvent: null,

  // Setters
  setCurrentProject: (project) => set({ currentProject: project }),
  setChapters: (chapters) => set({ chapters }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  setRecentProjects: (projects) => set({ recentProjects: projects }),
  addRecentProject: (project) => {
    const { recentProjects } = get()
    // Remove if already exists, then add to front
    const filtered = recentProjects.filter((p) => p.id !== project.id)
    set({ recentProjects: [project, ...filtered].slice(0, 10) })
  },

  // Translation setters
  setTranslating: (translating) => set({ isTranslating: translating }),
  setPaused: (paused) => set({ isPaused: paused }),
  updateTranslationProgress: (progress) => {
    set({ translationProgress: progress })

    // Update chapter status if we have chapter info
    if (progress.chapterId) {
      const { chapters } = get()
      const updatedChapters = chapters.map((ch) => {
        if (ch.id === progress.chapterId) {
          return { ...ch, status: progress.status === 'translating' ? 'translating' : ch.status }
        }
        return ch
      })
      set({ chapters: updatedChapters })
    }
  },
  updateChapterStatus: (chapterId, status) => {
    const { chapters } = get()
    const updatedChapters = chapters.map((ch) =>
      ch.id === chapterId ? { ...ch, status } : ch
    )
    set({ chapters: updatedChapters })
  },

  // Async actions
  loadProjects: async () => {
    if (!window.api) {
      console.error('[ProjectStore] window.api not available')
      return
    }

    set({ isLoading: true, error: null })
    try {
      const projects = await window.api.project.list()
      set({ recentProjects: projects, isLoading: false })
    } catch (error) {
      set({ error: String(error), isLoading: false })
    }
  },

  loadProject: async (id: string) => {
    if (!window.api) {
      console.error('[ProjectStore] window.api not available')
      set({ error: 'API not available', isLoading: false })
      return
    }

    set({ isLoading: true, error: null })
    try {
      const project = await window.api.project.get(id)
      if (project) {
        const chapters = await window.api.chapter.list(id)
        set({ currentProject: project, chapters, isLoading: false })
        get().addRecentProject(project)
      } else {
        set({ error: 'Project not found', isLoading: false, currentProject: null, chapters: [] })
      }
    } catch (error) {
      console.error('[ProjectStore] Failed to load project:', error)
      set({ error: String(error), isLoading: false, currentProject: null, chapters: [] })
    }
  },

  createProject: async (name: string, sourcePath?: string) => {
    set({ isLoading: true, error: null })
    try {
      const project = await window.api.project.create(name, sourcePath || '')
      get().addRecentProject(project)
      set({ isLoading: false })
      return project
    } catch (error) {
      set({ error: String(error), isLoading: false })
      throw error
    }
  },

  deleteProject: async (id: string) => {
    set({ isLoading: true, error: null })
    try {
      await window.api.project.delete(id)
      const { recentProjects, currentProject } = get()
      set({
        recentProjects: recentProjects.filter((p) => p.id !== id),
        currentProject: currentProject?.id === id ? null : currentProject,
        isLoading: false
      })
    } catch (error) {
      set({ error: String(error), isLoading: false })
      throw error
    }
  },

  startTranslation: async (projectId: string, chapterIds: string[], configId?: string) => {
    if (!window.api) {
      throw new Error('API not available')
    }

    set({ isTranslating: true, isPaused: false, error: null })
    try {
      await window.api.translation.start(projectId, chapterIds, configId)
    } catch (error) {
      set({ isTranslating: false, error: String(error) })
      throw error
    }
  },

  pauseTranslation: async (projectId: string) => {
    if (!window.api) return

    try {
      await window.api.translation.pause(projectId)
      set({ isPaused: true })
    } catch (error) {
      console.error('Failed to pause translation:', error)
    }
  },

  resumeTranslation: async (projectId: string) => {
    if (!window.api) return

    try {
      await window.api.translation.resume(projectId)
      set({ isPaused: false })
    } catch (error) {
      console.error('Failed to resume translation:', error)
    }
  },

  cancelTranslation: async (projectId: string) => {
    if (!window.api) return

    try {
      await window.api.translation.cancel(projectId)
      set({ isTranslating: false, isPaused: false, translationProgress: null })
    } catch (error) {
      console.error('Failed to cancel translation:', error)
    }
  },

  // Event subscriptions
  subscribeToEvents: () => {
    if (!window.api) return () => {}

    // Subscribe to translation progress events
    const unsubProgress = window.api.on.translationProgress((event) => {
      get().updateTranslationProgress(event)

      // Handle completion (translated = done, skipped = cancelled/skipped)
      if (event.progress >= 100 || event.status === 'error') {
        set({ isTranslating: false, isPaused: false })
        // Reload chapters to get updated statuses
        const { currentProject } = get()
        if (currentProject) {
          window.api.chapter.list(currentProject.id).then((chapters) => {
            set({ chapters })
          })
        }
      }
    })

    // Subscribe to fallback events
    const unsubFallback = window.api.on.chainFallback((event) => {
      set({ lastFallbackEvent: event })
      console.log('[Translation] Fallback triggered:', event)
    })

    // Return cleanup function
    return () => {
      unsubProgress()
      unsubFallback()
    }
  }
}))
