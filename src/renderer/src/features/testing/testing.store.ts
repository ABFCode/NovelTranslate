import { create } from 'zustand'
import type { TestRun, TestResult, TranslationConfig, CostEstimate } from '../../../../shared/types'

interface TestingState {
  // Data
  configs: TranslationConfig[]
  testRuns: TestRun[]
  currentRun: TestRun | null

  // Form state
  sampleText: string
  sourceLanguage: string
  targetLanguage: string
  selectedConfigIds: string[]

  // Loading states
  isLoading: boolean
  isRunning: boolean

  // Actions
  fetchConfigs: () => Promise<void>
  fetchTestRuns: () => Promise<void>
  setSampleText: (text: string) => void
  setSourceLanguage: (lang: string) => void
  setTargetLanguage: (lang: string) => void
  toggleConfigSelection: (configId: string) => void
  selectAllConfigs: () => void
  clearConfigSelection: () => void

  // Test execution
  runSingleTest: (name: string, configId: string) => Promise<TestRun>
  runComparisonTest: (name: string) => Promise<TestRun>
  estimateCost: (text: string, configId: string) => Promise<CostEstimate>

  // History
  loadTestRun: (id: string) => Promise<void>
  deleteTestRun: (id: string) => Promise<void>
}

export const useTestingStore = create<TestingState>((set, get) => ({
  configs: [],
  testRuns: [],
  currentRun: null,
  sampleText: '',
  sourceLanguage: 'auto',
  targetLanguage: 'en',
  selectedConfigIds: [],
  isLoading: false,
  isRunning: false,

  fetchConfigs: async () => {
    try {
      const configs = await window.api.config.list()
      set({ configs })
    } catch (error) {
      console.error('Failed to fetch configs:', error)
    }
  },

  fetchTestRuns: async () => {
    set({ isLoading: true })
    try {
      const testRuns = await window.api.test.list(50)
      set({ testRuns, isLoading: false })
    } catch (error) {
      console.error('Failed to fetch test runs:', error)
      set({ isLoading: false })
    }
  },

  setSampleText: (text) => set({ sampleText: text }),
  setSourceLanguage: (lang) => set({ sourceLanguage: lang }),
  setTargetLanguage: (lang) => set({ targetLanguage: lang }),

  toggleConfigSelection: (configId) => {
    const { selectedConfigIds } = get()
    if (selectedConfigIds.includes(configId)) {
      set({ selectedConfigIds: selectedConfigIds.filter((id) => id !== configId) })
    } else {
      set({ selectedConfigIds: [...selectedConfigIds, configId] })
    }
  },

  selectAllConfigs: () => {
    const { configs } = get()
    set({ selectedConfigIds: configs.map((c) => c.id) })
  },

  clearConfigSelection: () => {
    set({ selectedConfigIds: [] })
  },

  runSingleTest: async (name, configId) => {
    const { sampleText, sourceLanguage, targetLanguage } = get()
    set({ isRunning: true })

    try {
      const run = await window.api.test.runSingle(
        name,
        sampleText,
        configId,
        sourceLanguage,
        targetLanguage
      )
      set({ currentRun: run, isRunning: false })
      await get().fetchTestRuns()
      return run
    } catch (error) {
      set({ isRunning: false })
      throw error
    }
  },

  runComparisonTest: async (name) => {
    const { sampleText, sourceLanguage, targetLanguage, selectedConfigIds } = get()

    if (selectedConfigIds.length === 0) {
      throw new Error('Select at least one config')
    }

    set({ isRunning: true })

    try {
      const run = await window.api.test.runComparison(
        name,
        sampleText,
        selectedConfigIds,
        sourceLanguage,
        targetLanguage
      )
      set({ currentRun: run, isRunning: false })
      await get().fetchTestRuns()
      return run
    } catch (error) {
      set({ isRunning: false })
      throw error
    }
  },

  estimateCost: async (text, configId) => {
    return window.api.test.estimateCost(text, configId)
  },

  loadTestRun: async (id) => {
    try {
      const run = await window.api.test.getWithResults(id)
      set({ currentRun: run })
    } catch (error) {
      console.error('Failed to load test run:', error)
    }
  },

  deleteTestRun: async (id) => {
    try {
      await window.api.test.delete(id)
      const { currentRun } = get()
      if (currentRun?.id === id) {
        set({ currentRun: null })
      }
      await get().fetchTestRuns()
    } catch (error) {
      console.error('Failed to delete test run:', error)
    }
  }
}))
