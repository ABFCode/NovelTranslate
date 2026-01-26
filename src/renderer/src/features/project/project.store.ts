import { create } from 'zustand'
import type { Project, Chapter } from '@shared/types'

interface ProjectState {
  // Current project
  currentProject: Project | null
  chapters: Chapter[]
  isLoading: boolean
  error: string | null

  // Recent projects list
  recentProjects: Project[]

  // Actions
  setCurrentProject: (project: Project | null) => void
  setChapters: (chapters: Chapter[]) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  setRecentProjects: (projects: Project[]) => void
  addRecentProject: (project: Project) => void

  // Async actions (call IPC)
  loadProjects: () => Promise<void>
  loadProject: (id: string) => Promise<void>
  createProject: (name: string, sourcePath?: string) => Promise<Project>
  deleteProject: (id: string) => Promise<void>
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  // Initial state
  currentProject: null,
  chapters: [],
  isLoading: false,
  error: null,
  recentProjects: [],

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
    set({ isLoading: true, error: null })
    try {
      const project = await window.api.project.get(id)
      if (project) {
        const chapters = await window.api.chapter.list(id)
        set({ currentProject: project, chapters, isLoading: false })
        get().addRecentProject(project)
      } else {
        set({ error: 'Project not found', isLoading: false })
      }
    } catch (error) {
      set({ error: String(error), isLoading: false })
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
        isLoading: false,
      })
    } catch (error) {
      set({ error: String(error), isLoading: false })
      throw error
    }
  },
}))
