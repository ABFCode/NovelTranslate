import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import {
  BookOpen,
  Play,
  Pause,
  FileText,
  CheckCircle,
  AlertCircle,
  Clock,
  Settings2,
} from 'lucide-react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'motion/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { useFeatureMode } from '@/contexts/UIModeContext'
import { AdvancedSection, ShowAdvancedToggle } from '@/components/ModeToggle'
import { useProjectStore } from './project.store'
import { cn } from '@/lib/utils'
import type {
  Chapter,
  ChapterContent,
  ChapterStatus,
  ProjectConfig,
  TranslationConfig,
  TranslationOverride
} from '@shared/types'

export function ProjectPage() {
  const { projectId } = useParams({ from: '/project/$projectId' })
  const navigate = useNavigate()
  const { isAdvanced } = useFeatureMode('project')
  const {
    currentProject,
    chapters,
    isLoading,
    isTranslating,
    loadProject,
    startTranslation,
    pauseTranslation,
    cancelTranslation
  } = useProjectStore()

  // Config state
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
  const [glossaryStats, setGlossaryStats] = useState<{ termCount: number; suggestionCount: number }>({
    termCount: 0,
    suggestionCount: 0
  })
  const [overrideDraft, setOverrideDraft] = useState<{
    id?: string
    sourceSegment: string
    originalTranslation: string
    overrideTranslation: string
    scope: 'chapter' | 'project' | 'global'
    reason: string
  } | null>(null)

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
        window.api.glossary.getPendingSuggestions(pid)
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
      // Set default selected config
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
      // If project has a default config, use it
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
      // Remove existing default
      for (const pc of projectConfigs.filter((p) => p.isDefault)) {
        await window.api.projectConfig.remove(projectId, pc.configId)
      }
      // Set new default
      await window.api.projectConfig.assign(projectId, configId, true, 0)
      setSelectedConfigId(configId)
      await loadProjectConfigs(projectId)
      toast.success('Project config updated')
    } catch (error) {
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
    } catch (error) {
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
          reason: overrideDraft.reason || undefined
        })
      } else {
        await window.api.override.create({
          projectId,
          chapterId: activeChapterId || undefined,
          sourceSegment: overrideDraft.sourceSegment,
          originalTranslation: overrideDraft.originalTranslation,
          overrideTranslation: overrideDraft.overrideTranslation,
          scope: overrideDraft.scope,
          reason: overrideDraft.reason || undefined
        })
      }
      toast.success('Override saved')
      setOverrideDraft(null)
      await loadOverrides(projectId, activeChapterId || undefined)
    } catch (error) {
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
    } catch (error) {
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

  const handleSelectChapter = (chapterId: string): void => {
    setActiveChapterId(chapterId)
  }

  const overridesBySegment = useMemo(() => {
    return new Map(overrides.map((override) => [override.sourceSegment, override]))
  }, [overrides])

  const segments = useMemo(() => {
    if (!chapterContent?.sourceText) return []
    return splitSegments(chapterContent.sourceText)
  }, [chapterContent])

  const translatedSegments = useMemo(() => {
    if (!chapterContent?.translatedText) return []
    return splitSegments(chapterContent.translatedText)
  }, [chapterContent])

  const chapterPairs = useMemo(() => {
    return segments.map((segment, index) => ({
      source: segment,
      translation: translatedSegments[index] || ''
    }))
  }, [segments, translatedSegments])

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
            <p className="page-subtitle">
              {currentProject.metadata.author || 'Unknown Author'}
            </p>
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
                <Button variant="destructive" onClick={() => projectId && cancelTranslation(projectId)}>
                  Cancel
                </Button>
              </>
            ) : (
              <Button onClick={handleStartTranslation} disabled={!selectedConfigId}>
                <Play className="mr-2 h-4 w-4" />
                Translate{selectedChapters.size > 0 ? ` (${selectedChapters.size})` : ''}
              </Button>
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
                    {selectedConfig
                      ? `${selectedConfig.providerId} / ${selectedConfig.modelId}`
                      : 'No config selected'}
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
                        projectConfigs.some((pc) => pc.configId === selectedConfigId && pc.isDefault)
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

              {/* Budget Panel (Advanced) */}
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

            {/* Selection controls */}
            <AdvancedSection feature="project" className="border-b px-4 py-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {selectedChapters.size} selected
                </span>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={selectAllPending}>
                    Select Pending
                  </Button>
                  <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={clearSelection}>
                    Clear
                  </Button>
                </div>
              </div>
            </AdvancedSection>

            <TabsContent value="all" className="m-0 flex-1 overflow-hidden">
              <ChapterList
                chapters={chapters}
                selectedChapters={selectedChapters}
                onToggleSelection={toggleChapterSelection}
                activeChapterId={activeChapterId}
                onSelectChapter={handleSelectChapter}
                showSelection={isAdvanced}
              />
            </TabsContent>
            <TabsContent value="pending" className="m-0 flex-1 overflow-hidden">
              <ChapterList
                chapters={chapters.filter((c) => c.status === 'pending')}
                selectedChapters={selectedChapters}
                onToggleSelection={toggleChapterSelection}
                activeChapterId={activeChapterId}
                onSelectChapter={handleSelectChapter}
                showSelection={isAdvanced}
              />
            </TabsContent>
            <TabsContent value="error" className="m-0 flex-1 overflow-hidden">
              <ChapterList
                chapters={chapters.filter((c) => c.status === 'error')}
                selectedChapters={selectedChapters}
                onToggleSelection={toggleChapterSelection}
                activeChapterId={activeChapterId}
                onSelectChapter={handleSelectChapter}
                showSelection={isAdvanced}
              />
            </TabsContent>
          </Tabs>
        </div>

        {/* Chapter content viewer */}
        <div className="flex-1 overflow-auto p-6">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Chapter Preview</CardTitle>
                    {activeChapter && (
                      <span className="text-xs text-muted-foreground">
                        {activeChapter.title || `Chapter ${activeChapter.spineIndex + 1}`}
                      </span>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!activeChapterId ? (
                    <p className="text-muted-foreground">Select a chapter to view its content</p>
                  ) : isLoadingContent ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      Loading chapter content...
                    </div>
                  ) : chapterPairs.length === 0 ? (
                    <p className="text-muted-foreground">No chapter content available</p>
                  ) : (
                    <div className="space-y-4">
                      {chapterPairs.map((pair, index) => {
                        const override = overridesBySegment.get(pair.source)
                        const displayed = override ? override.overrideTranslation : pair.translation
                        return (
                          <div key={index} className="rounded-lg border p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">Segment {index + 1}</span>
                              <div className="flex items-center gap-2">
                                {override && (
                                  <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-600">
                                    Override ({override.scope})
                                  </span>
                                )}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    setOverrideDraft({
                                      id: override?.id,
                                      sourceSegment: pair.source,
                                      originalTranslation: pair.translation || '',
                                      overrideTranslation:
                                        override?.overrideTranslation || pair.translation || '',
                                      scope: override?.scope || 'chapter',
                                      reason: override?.reason || ''
                                    })
                                  }
                                >
                                  {override ? 'Edit Override' : 'Add Override'}
                                </Button>
                              </div>
                            </div>
                            <div className="grid gap-4 md:grid-cols-2">
                              <div className="space-y-1">
                                <span className="text-xs text-muted-foreground">Source</span>
                                <p className="whitespace-pre-wrap text-sm">{pair.source}</p>
                              </div>
                              <div className="space-y-1">
                                <span className="text-xs text-muted-foreground">Translation</span>
                                <p className="whitespace-pre-wrap text-sm">
                                  {displayed || (
                                    <span className="text-muted-foreground">No translation yet</span>
                                  )}
                                </p>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Glossary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Terms</span>
                    <span className="font-medium">{glossaryStats.termCount}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Pending suggestions</span>
                    <span className="font-medium">{glossaryStats.suggestionCount}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => navigate({ to: '/glossary' })}>
                      Open Glossary
                    </Button>
                    {glossaryStats.suggestionCount > 0 && (
                      <Button size="sm" onClick={() => navigate({ to: '/glossary' })}>
                        Review Suggestions
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Overrides</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {isLoadingOverrides ? (
                    <p className="text-sm text-muted-foreground">Loading overrides...</p>
                  ) : overrides.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No overrides yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {overrides.slice(0, 6).map((override) => (
                        <div key={override.id} className="rounded-md border px-3 py-2 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="truncate font-medium">{override.sourceSegment}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-xs hover:text-destructive"
                              onClick={() => handleDeleteOverride(override.id)}
                            >
                              Delete
                            </Button>
                          </div>
                          <div className="text-xs text-muted-foreground line-clamp-2">
                            {override.overrideTranslation}
                          </div>
                        </div>
                      ))}
                      {overrides.length > 6 && (
                        <div className="text-xs text-muted-foreground">
                          +{overrides.length - 6} more overrides
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>

      <Dialog open={overrideDraft !== null} onOpenChange={(open) => !open && setOverrideDraft(null)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Translation Override</DialogTitle>
          <DialogDescription>
            Save a manual correction for this segment. Overrides take priority over translation memory.
          </DialogDescription>
        </DialogHeader>
        {overrideDraft && (
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground">Source Segment</Label>
              <div className="mt-1 rounded-md border bg-muted/30 p-3 text-sm whitespace-pre-wrap">
                {overrideDraft.sourceSegment}
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Original Translation</Label>
              <div className="mt-1 rounded-md border bg-muted/30 p-3 text-sm whitespace-pre-wrap">
                {overrideDraft.originalTranslation || 'No translation yet'}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Override Translation</Label>
              <textarea
                rows={4}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={overrideDraft.overrideTranslation}
                onChange={(e) =>
                  setOverrideDraft({ ...overrideDraft, overrideTranslation: e.target.value })
                }
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Scope</Label>
                <Select
                  value={overrideDraft.scope}
                  onValueChange={(value) =>
                    setOverrideDraft({
                      ...overrideDraft,
                      scope: value as 'chapter' | 'project' | 'global'
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="chapter">Chapter only</SelectItem>
                    <SelectItem value="project">Project-wide</SelectItem>
                    <SelectItem value="global">Global</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Reason (optional)</Label>
                <Input
                  value={overrideDraft.reason}
                  onChange={(e) => setOverrideDraft({ ...overrideDraft, reason: e.target.value })}
                  placeholder="e.g., preferred name"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOverrideDraft(null)}>
                Cancel
              </Button>
              <Button onClick={handleSaveOverride} disabled={!overrideDraft.overrideTranslation.trim()}>
                Save Override
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
      </Dialog>
    </>
  )
}

interface ChapterListProps {
  chapters: Chapter[]
  selectedChapters: Set<string>
  onToggleSelection: (id: string) => void
  activeChapterId: string | null
  onSelectChapter: (id: string) => void
  showSelection: boolean
}

function ChapterList({
  chapters,
  selectedChapters,
  onToggleSelection,
  activeChapterId,
  onSelectChapter,
  showSelection
}: ChapterListProps) {
  if (chapters.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">No chapters</p>
      </div>
    )
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-2">
        {chapters.map((chapter) => (
          <ChapterItem
            key={chapter.id}
            chapter={chapter}
            isSelected={selectedChapters.has(chapter.id)}
            onToggleSelection={() => onToggleSelection(chapter.id)}
            onSelectChapter={() => onSelectChapter(chapter.id)}
            isActive={activeChapterId === chapter.id}
            showSelection={showSelection}
          />
        ))}
      </div>
    </ScrollArea>
  )
}

interface ChapterItemProps {
  chapter: Chapter
  isSelected: boolean
  onToggleSelection: () => void
  onSelectChapter: () => void
  isActive: boolean
  showSelection: boolean
}

function ChapterItem({
  chapter,
  isSelected,
  onToggleSelection,
  onSelectChapter,
  isActive,
  showSelection
}: ChapterItemProps) {
  return (
    <div
      className={cn(
        'flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 hover:bg-accent',
        isSelected && 'bg-primary/10',
        isActive && 'ring-1 ring-primary/30'
      )}
      onClick={onSelectChapter}
    >
      {showSelection && (
        <div
          className={cn(
            'flex h-4 w-4 items-center justify-center rounded border',
            isSelected ? 'border-primary bg-primary text-primary-foreground' : ''
          )}
          onClick={(event) => {
            event.stopPropagation()
            onToggleSelection()
          }}
        >
          {isSelected && <CheckIcon className="h-3 w-3" />}
        </div>
      )}
      <StatusIcon status={chapter.status} />
      <div className="flex-1 truncate">
        <p className="truncate text-sm">{chapter.title || `Chapter ${chapter.spineIndex + 1}`}</p>
      </div>
    </div>
  )
}

function StatusIcon({ status }: { status: ChapterStatus }) {
  switch (status) {
    case 'translated':
      return <CheckCircle className="h-4 w-4 shrink-0 text-green-600" />
    case 'error':
      return <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
    case 'translating':
      return <Clock className="h-4 w-4 shrink-0 animate-pulse text-yellow-600" />
    default:
      return <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
  }
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
    </svg>
  )
}

function getChapterStats(chapters: Chapter[]) {
  return {
    pending: chapters.filter((c) => c.status === 'pending').length,
    translating: chapters.filter((c) => c.status === 'translating').length,
    translated: chapters.filter((c) => c.status === 'translated').length,
    error: chapters.filter((c) => c.status === 'error').length,
    skipped: chapters.filter((c) => c.status === 'skipped').length
  }
}

function splitSegments(text: string): string[] {
  const normalized = text.replace(/\r\n/g, '\n').trim()
  if (!normalized) return []
  const blocks = normalized.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean)
  if (blocks.length > 1) return blocks
  return normalized.split('\n').map((line) => line.trim()).filter(Boolean)
}

// ============================================================================
// Budget Panel Component
// ============================================================================

interface BudgetPanelProps {
  projectId: string
}

function BudgetPanel({ projectId }: BudgetPanelProps): JSX.Element {
  const [budget, setBudget] = useState<{
    budgetUsd: number
    spentUsd: number
    alertThreshold: number
    hardLimit: boolean
  } | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [newBudget, setNewBudget] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    loadBudget()
  }, [projectId])

  const loadBudget = async (): Promise<void> => {
    try {
      const b = await window.api.budget.get(projectId)
      setBudget(b)
    } catch (error) {
      console.error('Failed to load budget:', error)
    }
  }

  const handleSaveBudget = async (): Promise<void> => {
    const value = parseFloat(newBudget)
    if (isNaN(value) || value < 0) {
      toast.error('Please enter a valid budget amount')
      return
    }

    setIsSaving(true)
    try {
      await window.api.budget.set(projectId, value, 0.8, false)
      await loadBudget()
      setIsEditing(false)
      toast.success('Budget updated')
    } catch (error) {
      toast.error('Failed to update budget')
    } finally {
      setIsSaving(false)
    }
  }

  const spentPercent = budget ? (budget.spentUsd / budget.budgetUsd) * 100 : 0
  const remaining = budget ? budget.budgetUsd - budget.spentUsd : 0

  return (
    <div className="rounded-lg border p-3 space-y-3">
      {budget && budget.budgetUsd > 0 ? (
        <>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Budget</span>
            <span className="text-sm">
              ${budget.spentUsd.toFixed(2)} / ${budget.budgetUsd.toFixed(2)}
            </span>
          </div>
          <Progress
            value={Math.min(spentPercent, 100)}
            className={cn(
              'h-2',
              spentPercent > 90 ? '[&>div]:bg-destructive' : spentPercent > 70 ? '[&>div]:bg-yellow-500' : ''
            )}
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>${remaining.toFixed(2)} remaining</span>
            <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setIsEditing(true)}>
              Edit
            </Button>
          </div>
        </>
      ) : isEditing ? (
        <div className="space-y-2">
          <label className="text-sm font-medium">Set Budget (USD)</label>
          <div className="flex gap-2">
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="e.g., 10.00"
              value={newBudget}
              onChange={(e) => setNewBudget(e.target.value)}
              className="flex-1"
            />
            <Button size="sm" onClick={handleSaveBudget} disabled={isSaving}>
              {isSaving ? '...' : 'Save'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">No budget set</span>
          <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
            Set Budget
          </Button>
        </div>
      )}
    </div>
  )
}
