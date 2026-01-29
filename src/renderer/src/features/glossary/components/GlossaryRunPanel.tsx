import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { CostEstimateDisplay } from '@/components/CostEstimateDisplay'
import { cn } from '@/lib/utils'
import type {
  Chapter,
  CostEstimate,
  GlossaryRunResult,
  ProviderInfo
} from '../../../../../shared/types'

interface GlossaryRunPanelProps {
  projectId: string | null
  chapters: Chapter[]
  isLoadingChapters: boolean
  onRunComplete?: (result: GlossaryRunResult) => void
}

export function GlossaryRunPanel({
  projectId,
  chapters,
  isLoadingChapters,
  onRunComplete
}: GlossaryRunPanelProps): JSX.Element {
  const [providers, setProviders] = useState<ProviderInfo[]>([])
  const [recommended, setRecommended] = useState<Array<{ providerId: string; modelId: string }>>([])
  const [providerId, setProviderId] = useState('')
  const [modelId, setModelId] = useState('')
  const [concurrency, setConcurrency] = useState(3)
  const [scope, setScope] = useState<'all' | 'selected'>('all')
  const [selectedChapterIds, setSelectedChapterIds] = useState<string[]>([])
  const [showChapterDialog, setShowChapterDialog] = useState(false)
  const [estimate, setEstimate] = useState<CostEstimate | null>(null)
  const [isEstimating, setIsEstimating] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [runProgress, setRunProgress] = useState<{ current: number; total: number } | null>(null)
  const [lastResult, setLastResult] = useState<GlossaryRunResult | null>(null)

  const chaptersForRun = useMemo(() => {
    if (scope === 'all') return chapters.map((c) => c.id)
    return selectedChapterIds
  }, [scope, chapters, selectedChapterIds])

  useEffect(() => {
    setSelectedChapterIds([])
    setScope('all')
    setLastResult(null)
    setRunProgress(null)
  }, [projectId])

  useEffect(() => {
    const loadProviders = async (): Promise<void> => {
      try {
        const [providerList, recommendedModels] = await Promise.all([
          window.api.provider.list(),
          window.api.glossaryRun.getRecommendedModels()
        ])
        setProviders(providerList)
        setRecommended(recommendedModels)

        if (recommendedModels.length > 0) {
          setProviderId(recommendedModels[0].providerId)
          setModelId(recommendedModels[0].modelId)
        } else if (providerList.length > 0) {
          setProviderId(providerList[0].id)
          setModelId(providerList[0].models[0]?.id || '')
        }
      } catch (error) {
        console.error('Failed to load providers:', error)
      }
    }

    loadProviders()
  }, [])

  useEffect(() => {
    if (!providerId) return
    const models = providers.find((provider) => provider.id === providerId)?.models || []
    if (models.length === 0) {
      setModelId('')
      return
    }
    if (!models.some((model) => model.id === modelId)) {
      setModelId(models[0].id)
    }
  }, [providerId, providers, modelId])

  useEffect(() => {
    if (!projectId || !providerId || !modelId || chaptersForRun.length === 0) {
      setEstimate(null)
      return
    }

    let cancelled = false
    setIsEstimating(true)
    window.api.glossaryRun
      .estimateCost(projectId, chaptersForRun, providerId, modelId)
      .then((result) => {
        if (cancelled) return
        setEstimate(result)
      })
      .catch((error) => {
        if (!cancelled) {
          console.error('Failed to estimate cost:', error)
          setEstimate(null)
        }
      })
      .finally(() => {
        if (!cancelled) setIsEstimating(false)
      })

    return () => {
      cancelled = true
    }
  }, [projectId, providerId, modelId, chaptersForRun])

  useEffect(() => {
    const unsubscribe = window.api.on.glossaryRunProgress((event) => {
      if (event.projectId !== projectId) return
      setRunProgress({ current: event.current, total: event.total })
    })
    return () => { unsubscribe() }
  }, [projectId])

  const availableModels = providers.find((p) => p.id === providerId)?.models || []

  const handleRun = async (): Promise<void> => {
    if (!projectId || !providerId || !modelId || chaptersForRun.length === 0) {
      toast.error('Select a project, model, and at least one chapter')
      return
    }

    setIsRunning(true)
    setRunProgress(null)
    setLastResult(null)
    try {
      const result = await window.api.glossaryRun.run(
        projectId,
        chaptersForRun,
        providerId,
        modelId,
        concurrency
      )
      setLastResult(result)
      onRunComplete?.(result)
      toast.success(`Created ${result.totalSuggestions} suggestions`)
    } catch (error) {
      console.error('Glossary run failed:', error)
      toast.error('Glossary extraction failed')
    } finally {
      setIsRunning(false)
    }
  }

  if (!projectId) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-4 text-sm text-muted-foreground">
          Select a project to run glossary extraction.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Extract suggestions from chapters</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Provider</Label>
            <Select value={providerId} onValueChange={setProviderId}>
              <SelectTrigger>
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent>
                {providers.map((provider) => (
                  <SelectItem key={provider.id} value={provider.id}>
                    {provider.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Model</Label>
            <Select value={modelId} onValueChange={setModelId}>
              <SelectTrigger>
                <SelectValue placeholder="Select model" />
              </SelectTrigger>
              <SelectContent>
                {availableModels.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    {model.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {recommended.some((r) => r.providerId === providerId && r.modelId === modelId) && (
              <span className="text-xs text-emerald-600">Recommended</span>
            )}
          </div>
          <div className="space-y-2">
            <Label>Concurrency</Label>
            <Input
              type="number"
              min={1}
              max={5}
              value={concurrency}
              onChange={(e) => {
                const value = Number(e.target.value)
                setConcurrency(Number.isFinite(value) ? Math.max(1, Math.min(5, value)) : 1)
              }}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-md border p-1 text-xs">
            <button
              type="button"
              className={cn(
                'rounded px-2 py-1',
                scope === 'all' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
              )}
              onClick={() => setScope('all')}
            >
              All chapters ({chapters.length})
            </button>
            <button
              type="button"
              className={cn(
                'rounded px-2 py-1',
                scope === 'selected' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
              )}
              onClick={() => setScope('selected')}
            >
              Selected ({selectedChapterIds.length})
            </button>
          </div>
          {scope === 'selected' && (
            <Button variant="outline" size="sm" onClick={() => setShowChapterDialog(true)}>
              Choose chapters
            </Button>
          )}
          {isLoadingChapters && <span className="text-xs text-muted-foreground">Loading chapters...</span>}
        </div>

        {estimate ? (
          <CostEstimateDisplay estimate={estimate} compact />
        ) : (
          <span className="text-xs text-muted-foreground">
            {isEstimating ? 'Estimating cost...' : 'Choose chapters and model to estimate cost'}
          </span>
        )}

        {runProgress && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Processing chapters</span>
              <span>
                {runProgress.current} / {runProgress.total}
              </span>
            </div>
            <Progress
              value={
                runProgress.total > 0 ? (runProgress.current / runProgress.total) * 100 : 0
              }
            />
          </div>
        )}

        {lastResult && (
          <div className="rounded-lg border bg-muted/30 p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium">Last run</span>
              <span className="text-xs text-muted-foreground">
                {lastResult.processedChapters} chapters - {lastResult.totalSuggestions} suggestions
              </span>
            </div>
            {lastResult.errors.length > 0 && (
              <div className="mt-2 text-xs text-yellow-700">
                {lastResult.errors.slice(0, 2).join(' - ')}
                {lastResult.errors.length > 2 && ` (+${lastResult.errors.length - 2} more)`}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowChapterDialog(true)} disabled={scope !== 'selected'}>
            Preview selection
          </Button>
          <Button onClick={handleRun} disabled={isRunning || chaptersForRun.length === 0}>
            {isRunning ? 'Running...' : 'Run extraction'}
          </Button>
        </div>

        <Dialog open={showChapterDialog} onOpenChange={setShowChapterDialog}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>Select chapters</DialogTitle>
              <DialogDescription>Choose the chapters to scan for glossary suggestions.</DialogDescription>
            </DialogHeader>
            <ScrollArea className="h-[360px] rounded-md border">
              <div className="divide-y">
                {chapters.map((chapter) => {
                  const isSelected = selectedChapterIds.includes(chapter.id)
                  return (
                    <label key={chapter.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() =>
                          setSelectedChapterIds((prev) =>
                            isSelected ? prev.filter((id) => id !== chapter.id) : [...prev, chapter.id]
                          )
                        }
                      />
                      <span className="truncate">
                        {chapter.title || `Chapter ${chapter.spineIndex + 1}`}
                      </span>
                    </label>
                  )
                })}
              </div>
            </ScrollArea>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{selectedChapterIds.length} selected</span>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedChapterIds(chapters.map((c) => c.id))}
                >
                  Select all
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowChapterDialog(false)}>
                  Done
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}
