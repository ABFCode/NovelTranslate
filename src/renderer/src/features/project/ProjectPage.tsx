import type {
  Chapter,
  ChapterContent,
  ProjectConfig,
  TranslationConfig,
  TranslationOverride,
} from '@shared/types'
import { useParams } from '@tanstack/react-router'
import { BookOpen, Eye, History, Pause, Play, RotateCcw, Settings2 } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { AdvancedSection, ShowAdvancedToggle } from '@/components/ModeToggle'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useFeatureMode } from '@/contexts/UIModeContext'
import {
  BudgetPanel,
  ChapterContentViewer,
  ChapterList,
  GlossarySummary,
  OverrideDialog,
  type OverrideDraft,
  OverridesList,
  PreviewDialog,
  TranslationHistory,
} from './components'
import { useProjectStore } from './project.store'

export function ProjectPage() {
  const { projectId } = useParams({ from: '/project/$projectId' })
  const { isAdvanced } = useFeatureMode('project')
  const {
    currentProject,
    chapters,
    isLoading,
    isTranslating,
    loadProject,
    startTranslation,
    pauseTranslation,
    cancelTranslation,
  } = useProjectStore()

  const [configs, setConfigs] = useState<TranslationConfig[]>([])
  const [projectConfigs, setProjectConfigs] = useState<ProjectConfig[]>([])
  const [selectedConfigId, setSelectedConfigId] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [selectedChapters, setSelectedChapters] = useState<Set<string>>(new Set())
  const [activeChapterId, setActiveChapterId] = useState<string | null>(null)
  const [chapterContent, setChapterContent] = useState<ChapterContent | null>(null)
  const [isLoadingContent, setIsLoadingContent] = useState(false)
  const [overrides, setOverrides] = useState<TranslationOverride[]>([])
  const [isLoadingOverrides, setIsLoadingOverrides] = useState(false)
  const [glossaryStats, setGlossaryStats] = useState({ termCount: 0, suggestionCount: 0 })
  const [overrideDraft, setOverrideDraft] = useState<OverrideDraft | null>(null)
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false)
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false)

  useEffect(() => {
    if (projectId) {
      loadProject(projectId)
      loadConfigs()
      loadProjectConfigs(projectId)
      loadGlossaryStats(projectId)
    }
  }, [projectId, loadProject])

  useEffect(() => {
    if (projectId && activeChapterId) {
      loadChapterContent(activeChapterId)
      loadOverrides(projectId, activeChapterId)
    } else {
      setChapterContent(null)
      setOverrides([])
    }
  }, [projectId, activeChapterId])

  useEffect(() => {
    if (!activeChapterId && chapters.length > 0) {
      setActiveChapterId(chapters[0].id)
    }
  }, [activeChapterId, chapters])

  useEffect(() => {
    if (activeChapterId && chapters.length > 0) {
      const exists = chapters.some((chapter) => chapter.id === activeChapterId)
      if (!exists) {
        setActiveChapterId(chapters[0]?.id || null)
      }
    }
  }, [activeChapterId, chapters])

  const loadGlossaryStats = async (pid: string): Promise<void> => {
    try {
      const [terms, suggestions] = await Promise.all([
        window.api.glossary.list(pid),
        window.api.glossary.getPendingSuggestions(pid),
      ])
      setGlossaryStats({ termCount: terms.length, suggestionCount: suggestions.length })
    } catch (error) {
      console.error('Failed to load glossary stats:', error)
    }
  }

  const loadChapterContent = async (chapterId: string): Promise<void> => {
    setIsLoadingContent(true)
    try {
      const content = await window.api.chapter.getContent(chapterId)
      setChapterContent(content)
    } catch (error) {
      console.error('Failed to load chapter content:', error)
      setChapterContent(null)
    } finally {
      setIsLoadingContent(false)
    }
  }

  const loadOverrides = async (pid: string, chapterId?: string): Promise<void> => {
    setIsLoadingOverrides(true)
    try {
      const list = await window.api.override.list(pid, chapterId)
      setOverrides(list)
    } catch (error) {
      console.error('Failed to load overrides:', error)
      setOverrides([])
    } finally {
      setIsLoadingOverrides(false)
    }
  }

  const loadConfigs = async (): Promise<void> => {
    try {
      const c = await window.api.config.list()
      setConfigs(c)
      const defaultConfig = c.find((config) => config.isDefault)
      if (defaultConfig) {
        setSelectedConfigId(defaultConfig.id)
      } else if (c.length > 0) {
        setSelectedConfigId(c[0].id)
      }
    } catch (error) {
      console.error('Failed to load configs:', error)
    }
  }

  const loadProjectConfigs = async (pid: string): Promise<void> => {
    try {
      const pc = await window.api.projectConfig.list(pid)
      setProjectConfigs(pc)
      const projectDefault = pc.find((c) => c.isDefault)
      if (projectDefault) {
        setSelectedConfigId(projectDefault.configId)
      }
    } catch (error) {
      console.error('Failed to load project configs:', error)
    }
  }

  const handleSetProjectConfig = async (configId: string): Promise<void> => {
    if (!projectId) return
    try {
      for (const pc of projectConfigs.filter((p) => p.isDefault)) {
        await window.api.projectConfig.remove(projectId, pc.configId)
      }
      await window.api.projectConfig.assign(projectId, configId, true, 0)
      setSelectedConfigId(configId)
      await loadProjectConfigs(projectId)
      toast.success('Project config updated')
    } catch (_error) {
      toast.error('Failed to set project config')
    }
  }

  const handleStartTranslation = async (): Promise<void> => {
    if (!projectId || !selectedConfigId) {
      toast.error('Please select a config')
      return
    }

    const chapterIds =
      selectedChapters.size > 0
        ? Array.from(selectedChapters)
        : chapters.filter((c) => c.status === 'pending' || c.status === 'error').map((c) => c.id)

    if (chapterIds.length === 0) {
      toast.info('No chapters to translate')
      return
    }

    try {
      await startTranslation(projectId, chapterIds, selectedConfigId)
      setSelectedChapters(new Set())
    } catch (error) {
      toast.error(`Failed to start translation: ${error}`)
    }
  }

  const handlePauseTranslation = async (): Promise<void> => {
    if (!projectId) return
    try {
      await pauseTranslation(projectId)
    } catch (_error) {
      toast.error('Failed to pause translation')
    }
  }

  const handleSaveOverride = async (): Promise<void> => {
    if (!projectId || !overrideDraft) return

    try {
      if (overrideDraft.id) {
        await window.api.override.update(overrideDraft.id, {
          chapterId: activeChapterId || undefined,
          sourceSegment: overrideDraft.sourceSegment,
          originalTranslation: overrideDraft.originalTranslation,
          overrideTranslation: overrideDraft.overrideTranslation,
          scope: overrideDraft.scope,
          reason: overrideDraft.reason || undefined,
        })
      } else {
        await window.api.override.create({
          projectId,
          chapterId: activeChapterId || undefined,
          sourceSegment: overrideDraft.sourceSegment,
          originalTranslation: overrideDraft.originalTranslation,
          overrideTranslation: overrideDraft.overrideTranslation,
          scope: overrideDraft.scope,
          reason: overrideDraft.reason || undefined,
        })
      }
      toast.success('Override saved')
      setOverrideDraft(null)
      await loadOverrides(projectId, activeChapterId || undefined)
    } catch (_error) {
      toast.error('Failed to save override')
    }
  }

  const handleDeleteOverride = async (id: string): Promise<void> => {
    if (!projectId) return
    if (!confirm('Delete this override?')) return
    try {
      await window.api.override.delete(id)
      await loadOverrides(projectId, activeChapterId || undefined)
      toast.success('Override deleted')
    } catch (_error) {
      toast.error('Failed to delete override')
    }
  }

  const toggleChapterSelection = (chapterId: string): void => {
    setSelectedChapters((prev) => {
      const next = new Set(prev)
      if (next.has(chapterId)) {
        next.delete(chapterId)
      } else {
        next.add(chapterId)
      }
      return next
    })
  }

  const selectAllPending = (): void => {
    const pendingIds = chapters
      .filter((c) => c.status === 'pending' || c.status === 'error')
      .map((c) => c.id)
    setSelectedChapters(new Set(pendingIds))
  }

  const clearSelection = (): void => {
    setSelectedChapters(new Set())
  }

  const selectAllTranslated = (): void => {
    const translatedIds = chapters.filter((c) => c.status === 'translated').map((c) => c.id)
    setSelectedChapters(new Set(translatedIds))
  }

  const handleClearSelectedTranslations = async (): Promise<void> => {
    if (selectedChapters.size === 0) return
    if (
      !confirm(`Clear translations for ${selectedChapters.size} chapter(s)? This cannot be undone.`)
    ) {
      return
    }

    try {
      const chapterIds = Array.from(selectedChapters)
      const clearedCount = await window.api.chapter.clearTranslations(chapterIds)
      toast.success(`Cleared translations for ${clearedCount} chapter(s)`)
      setSelectedChapters(new Set())
      // Reload chapters to reflect changes
      if (projectId) {
        loadProject(projectId)
      }
    } catch (error) {
      toast.error('Failed to clear translations')
      console.error('Failed to clear translations:', error)
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!currentProject) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Project not found</p>
      </div>
    )
  }

  const stats = getChapterStats(chapters)
  const progressPercent = chapters.length > 0 ? (stats.translated / chapters.length) * 100 : 0
  const selectedConfig = configs.find((c) => c.id === selectedConfigId)
  const activeChapter = chapters.find((chapter) => chapter.id === activeChapterId)

  return (
    <>
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="page-header">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="page-title flex items-center gap-3">
                <BookOpen className="h-7 w-7 text-primary" />
                {currentProject.name}
              </h1>
              <p className="page-subtitle">{currentProject.metadata.author || 'Unknown Author'}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => setShowSettings(!showSettings)}>
                <Settings2 className="h-4 w-4" />
              </Button>
              {isTranslating ? (
                <>
                  <Button variant="outline" onClick={handlePauseTranslation}>
                    <Pause className="mr-2 h-4 w-4" />
                    Pause
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => projectId && cancelTranslation(projectId)}
                  >
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    onClick={() => setHistoryDialogOpen(true)}
                    disabled={!activeChapterId}
                    title="View translation history"
                  >
                    <History className="mr-2 h-4 w-4" />
                    History
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setPreviewDialogOpen(true)}
                    disabled={!selectedConfigId || !chapterContent?.sourceText}
                    title="Preview translation for active chapter"
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    Preview
                  </Button>
                  <Button onClick={handleStartTranslation} disabled={!selectedConfigId}>
                    <Play className="mr-2 h-4 w-4" />
                    Translate{selectedChapters.size > 0 ? ` (${selectedChapters.size})` : ''}
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Config selector (simple) */}
          {!isAdvanced && (
            <div className="mt-4 flex items-center gap-4">
              <span className="text-sm text-muted-foreground">Using config:</span>
              <Select value={selectedConfigId || ''} onValueChange={setSelectedConfigId}>
                <SelectTrigger className="w-60">
                  <SelectValue placeholder="Select config..." />
                </SelectTrigger>
                <SelectContent>
                  {configs.map((config) => (
                    <SelectItem key={config.id} value={config.id}>
                      {config.name}
                      {config.isDefault && ' (default)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Progress bar */}
          <div className="mt-4">
            <div className="mb-2 flex justify-between text-sm">
              <span className="text-muted-foreground">Translation Progress</span>
              <span className="font-medium">
                {stats.translated} / {chapters.length} chapters
              </span>
            </div>
            <Progress value={progressPercent} className="h-2" />
          </div>
        </div>

        {/* Settings panel */}
        <AnimatePresence>
          {showSettings && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-b bg-muted/30"
            >
              <div className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">Project Settings</h3>
                  <ShowAdvancedToggle feature="project" />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Translation Config</label>
                    <Select value={selectedConfigId || ''} onValueChange={setSelectedConfigId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select config..." />
                      </SelectTrigger>
                      <SelectContent>
                        {configs.map((config) => (
                          <SelectItem key={config.id} value={config.id}>
                            {config.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {selectedConfig ? selectedConfig.modelId : 'No config selected'}
                    </p>
                  </div>

                  <AdvancedSection feature="project">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Set as Project Default</label>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => selectedConfigId && handleSetProjectConfig(selectedConfigId)}
                        disabled={
                          !selectedConfigId ||
                          projectConfigs.some(
                            (pc) => pc.configId === selectedConfigId && pc.isDefault
                          )
                        }
                      >
                        Set as Default for This Project
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        This config will be used automatically when opening this project
                      </p>
                    </div>
                  </AdvancedSection>
                </div>

                <AdvancedSection feature="project" title="Budget">
                  <BudgetPanel projectId={projectId!} />
                </AdvancedSection>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Chapter list */}
          <div className="w-80 border-r">
            <Tabs defaultValue="all" className="flex h-full flex-col">
              <div className="border-b px-4 py-2">
                <TabsList className="w-full">
                  <TabsTrigger value="all" className="flex-1">
                    All ({chapters.length})
                  </TabsTrigger>
                  <TabsTrigger value="pending" className="flex-1">
                    Pending ({stats.pending})
                  </TabsTrigger>
                  <TabsTrigger value="error" className="flex-1">
                    Errors ({stats.error})
                  </TabsTrigger>
                </TabsList>
              </div>

              <AdvancedSection feature="project" className="border-b px-4 py-2">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {selectedChapters.size} selected
                    </span>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs"
                        onClick={selectAllPending}
                      >
                        Pending
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs"
                        onClick={selectAllTranslated}
                      >
                        Translated
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs"
                        onClick={clearSelection}
                      >
                        Clear
                      </Button>
                    </div>
                  </div>
                  {/* Batch actions toolbar */}
                  {selectedChapters.size > 0 && (
                    <div className="flex gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 flex-1 text-xs"
                        onClick={handleStartTranslation}
                        disabled={isTranslating || !selectedConfigId}
                      >
                        <Play className="mr-1 h-3 w-3" />
                        Translate ({selectedChapters.size})
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 flex-1 text-xs"
                        onClick={handleClearSelectedTranslations}
                        disabled={isTranslating}
                      >
                        <RotateCcw className="mr-1 h-3 w-3" />
                        Clear ({selectedChapters.size})
                      </Button>
                    </div>
                  )}
                </div>
              </AdvancedSection>

              <TabsContent value="all" className="m-0 flex-1 overflow-hidden">
                <ChapterList
                  chapters={chapters}
                  selectedChapters={selectedChapters}
                  onToggleSelection={toggleChapterSelection}
                  activeChapterId={activeChapterId}
                  onSelectChapter={setActiveChapterId}
                  showSelection={isAdvanced}
                />
              </TabsContent>
              <TabsContent value="pending" className="m-0 flex-1 overflow-hidden">
                <ChapterList
                  chapters={chapters.filter((c) => c.status === 'pending')}
                  selectedChapters={selectedChapters}
                  onToggleSelection={toggleChapterSelection}
                  activeChapterId={activeChapterId}
                  onSelectChapter={setActiveChapterId}
                  showSelection={isAdvanced}
                />
              </TabsContent>
              <TabsContent value="error" className="m-0 flex-1 overflow-hidden">
                <ChapterList
                  chapters={chapters.filter((c) => c.status === 'error')}
                  selectedChapters={selectedChapters}
                  onToggleSelection={toggleChapterSelection}
                  activeChapterId={activeChapterId}
                  onSelectChapter={setActiveChapterId}
                  showSelection={isAdvanced}
                />
              </TabsContent>
            </Tabs>
          </div>

          {/* Chapter content viewer */}
          <div className="flex-1 overflow-auto p-6">
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
              <ChapterContentViewer
                activeChapter={activeChapter}
                chapterContent={chapterContent}
                isLoadingContent={isLoadingContent}
                overrides={overrides}
                onOverrideDraft={setOverrideDraft}
              />

              <div className="space-y-6">
                <GlossarySummary
                  termCount={glossaryStats.termCount}
                  suggestionCount={glossaryStats.suggestionCount}
                />
                <OverridesList
                  overrides={overrides}
                  isLoading={isLoadingOverrides}
                  onDelete={handleDeleteOverride}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <OverrideDialog
        draft={overrideDraft}
        onDraftChange={setOverrideDraft}
        onSave={handleSaveOverride}
      />

      <PreviewDialog
        open={previewDialogOpen}
        onOpenChange={setPreviewDialogOpen}
        sourceText={chapterContent?.sourceText || null}
        configId={selectedConfigId}
        sourceLanguage={currentProject?.sourceLanguage || 'auto'}
        targetLanguage={currentProject?.targetLanguage || 'en'}
        onTranslateChapter={
          activeChapterId
            ? () => {
                setSelectedChapters(new Set([activeChapterId]))
                handleStartTranslation()
              }
            : undefined
        }
      />

      <TranslationHistory
        chapterId={activeChapterId}
        chapterTitle={activeChapter?.title}
        open={historyDialogOpen}
        onOpenChange={setHistoryDialogOpen}
        onRestore={() => {
          if (activeChapterId) {
            loadChapterContent(activeChapterId)
          }
        }}
      />
    </>
  )
}

function getChapterStats(chapters: Chapter[]) {
  return {
    pending: chapters.filter((c) => c.status === 'pending').length,
    translating: chapters.filter((c) => c.status === 'translating').length,
    translated: chapters.filter((c) => c.status === 'translated').length,
    error: chapters.filter((c) => c.status === 'error').length,
    skipped: chapters.filter((c) => c.status === 'skipped').length,
  }
}
