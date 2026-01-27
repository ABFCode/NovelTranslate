import { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { toast } from 'sonner'
import { useGlossaryStore } from './glossary.store'
import { useFeatureMode } from '@/contexts/UIModeContext'
import { FeatureModeToggle, AdvancedSection } from '@/components/ModeToggle'
import { GlossarySkeleton } from '@/components/Skeleton/GlossarySkeleton'
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
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { CostEstimateDisplay } from '@/components/CostEstimateDisplay'
import { cn } from '@/lib/utils'
import type {
  Chapter,
  CostEstimate,
  GlossaryRunResult,
  GlossarySuggestion,
  GlossaryTerm,
  ProviderInfo,
  Project,
  TermType
} from '../../../../shared/types'

const TERM_TYPES: { value: TermType | 'all'; label: string }[] = [
  { value: 'all', label: 'All Types' },
  { value: 'name', label: 'Names' },
  { value: 'place', label: 'Places' },
  { value: 'skill', label: 'Skills' },
  { value: 'item', label: 'Items' },
  { value: 'honorific', label: 'Honorifics' },
  { value: 'other', label: 'Other' }
]

export function GlossaryPage(): JSX.Element {
  const { isAdvanced } = useFeatureMode('glossary')
  const {
    terms,
    suggestions,
    selectedProjectId,
    searchQuery,
    filterType,
    isLoading,
    selectedTerm,
    fetchTerms,
    fetchSuggestions,
    clearSuggestions,
    setSelectedProjectId,
    setSearchQuery,
    setFilterType,
    selectTerm,
    createTerm,
    updateTerm,
    deleteTerm,
    acceptSuggestion,
    rejectSuggestion,
    mergeSuggestion,
    importCSV,
    exportCSV,
    getFilteredTerms
  } = useGlossaryStore()

  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [showSuggestionsDialog, setShowSuggestionsDialog] = useState(false)
  const [projects, setProjects] = useState<Project[]>([])
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [isLoadingProjects, setIsLoadingProjects] = useState(false)
  const [isLoadingChapters, setIsLoadingChapters] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const loadProjects = async (): Promise<void> => {
      setIsLoadingProjects(true)
      try {
        const list = await window.api.project.list()
        setProjects(list)
      } catch (error) {
        console.error('Failed to load projects:', error)
      } finally {
        setIsLoadingProjects(false)
      }
    }

    loadProjects()
  }, [])

  const loadChapters = useCallback(async (projectId: string): Promise<void> => {
    setIsLoadingChapters(true)
    try {
      const list = await window.api.chapter.list(projectId)
      setChapters(list)
    } catch (error) {
      console.error('Failed to load chapters:', error)
      setChapters([])
    } finally {
      setIsLoadingChapters(false)
    }
  }, [])

  useEffect(() => {
    fetchTerms(selectedProjectId || undefined)

    if (selectedProjectId) {
      fetchSuggestions(selectedProjectId)
      loadChapters(selectedProjectId)
    } else {
      clearSuggestions()
      setChapters([])
    }
  }, [selectedProjectId, fetchTerms, fetchSuggestions, clearSuggestions, loadChapters])

  const filteredTerms = getFilteredTerms()

  const handleExport = async (): Promise<void> => {
    try {
      const csv = await exportCSV(selectedProjectId || undefined)
      // Download the CSV
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'glossary.csv'
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Glossary exported')
    } catch (error) {
      toast.error('Failed to export glossary')
    }
  }

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      const result = await importCSV(text, selectedProjectId || null)
      toast.success(`Imported ${result.imported} terms, skipped ${result.skipped}`)
      if (result.errors.length > 0) {
        console.warn('Import errors:', result.errors)
      }
      setShowImportDialog(false)
    } catch (error) {
      toast.error('Failed to import glossary')
    }
  }

  const handleDelete = async (term: GlossaryTerm): Promise<void> => {
    if (!confirm(`Delete "${term.sourceTerm}"?`)) return
    try {
      await deleteTerm(term.id)
      toast.success('Term deleted')
    } catch (error) {
      toast.error('Failed to delete term')
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Glossary</h1>
          <p className="page-subtitle">
            Manage translation terminology for consistency
          </p>
        </div>
        <div className="flex items-center gap-2">
          <FeatureModeToggle feature="glossary" />
          <Button variant="outline" onClick={handleExport}>
            <ExportIcon className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <ImportIcon className="mr-2 h-4 w-4" />
                Import
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Import Glossary</DialogTitle>
                <DialogDescription>
                  Upload a CSV file with Source Term, Target Term, Type, Gender, Notes columns
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleImportFile}
                  className="w-full"
                />
              </div>
            </DialogContent>
          </Dialog>
          <Button onClick={() => setShowAddDialog(true)}>
            <PlusIcon className="mr-2 h-4 w-4" />
            Add Term
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 border-b px-6 py-3">
        <Input
          placeholder="Search terms..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-sm"
        />
        <Select
          value={selectedProjectId || 'global'}
          onValueChange={(value) => setSelectedProjectId(value === 'global' ? null : value)}
        >
          <SelectTrigger className="w-52">
            <SelectValue placeholder={isLoadingProjects ? 'Loading projects...' : 'Select scope'} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="global">Global glossary</SelectItem>
            {projects.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={(v) => setFilterType(v as TermType | 'all')}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TERM_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto text-sm text-muted-foreground">
          {filteredTerms.length} of {terms.length} terms
        </div>
      </div>

      {/* Suggestions banner (advanced mode) */}
      {isAdvanced && suggestions.length > 0 && (
        <div className="flex items-center justify-between border-b bg-yellow-500/10 px-6 py-2">
          <span className="text-sm">
            <strong>{suggestions.length}</strong> pending suggestions to review
          </span>
          <Button size="sm" variant="outline" onClick={() => setShowSuggestionsDialog(true)}>
            Review Suggestions
          </Button>
        </div>
      )}

      {/* Glossary run (advanced mode) */}
      <AdvancedSection feature="glossary" className="border-b px-6 py-4" title="Glossary Extraction">
        <GlossaryRunPanel
          projectId={selectedProjectId}
          chapters={chapters}
          isLoadingChapters={isLoadingChapters}
          onRunComplete={() => {
            if (selectedProjectId) {
              fetchSuggestions(selectedProjectId)
            }
          }}
        />
      </AdvancedSection>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="p-6">
            <GlossarySkeleton />
          </div>
        ) : filteredTerms.length === 0 ? (
          <EmptyState onAdd={() => setShowAddDialog(true)} />
        ) : (
          <TermTable
            terms={filteredTerms}
            onEdit={selectTerm}
            onDelete={handleDelete}
            isAdvanced={isAdvanced}
          />
        )}
      </div>

      {/* Add/Edit Dialog */}
      <TermDialog
        open={showAddDialog || selectedTerm !== null}
        term={selectedTerm}
        onClose={() => {
          setShowAddDialog(false)
          selectTerm(null)
        }}
        onSave={async (data) => {
          if (selectedTerm) {
            await updateTerm(selectedTerm.id, data)
            toast.success('Term updated')
          } else {
            await createTerm({
              ...data,
              projectId: selectedProjectId || null,
              autoGenerated: false,
              confidence: 1.0
            })
            toast.success('Term created')
          }
          setShowAddDialog(false)
          selectTerm(null)
        }}
      />

      {/* Suggestions Review Dialog */}
      <SuggestionReviewDialog
        open={showSuggestionsDialog}
        onOpenChange={setShowSuggestionsDialog}
        suggestions={suggestions}
        terms={terms}
        onAccept={acceptSuggestion}
        onReject={rejectSuggestion}
        onMerge={mergeSuggestion}
        projectId={selectedProjectId}
      />
    </div>
  )
}

// ============================================================================
// Sub-components
// ============================================================================

interface TermTableProps {
  terms: GlossaryTerm[]
  onEdit: (term: GlossaryTerm) => void
  onDelete: (term: GlossaryTerm) => void
  isAdvanced: boolean
}

function TermTable({ terms, onEdit, onDelete, isAdvanced }: TermTableProps): JSX.Element {
  return (
    <div className="border-b">
      <table className="w-full">
        <thead className="border-b bg-muted/50 sticky top-0">
          <tr>
            <th className="px-6 py-3 text-left text-sm font-medium">Source</th>
            <th className="px-6 py-3 text-left text-sm font-medium">Translation</th>
            <th className="px-6 py-3 text-left text-sm font-medium">Type</th>
            {isAdvanced && <th className="px-6 py-3 text-left text-sm font-medium">Gender</th>}
            {isAdvanced && <th className="px-6 py-3 text-left text-sm font-medium">Usage</th>}
            <th className="px-6 py-3 text-right text-sm font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          <AnimatePresence>
            {terms.map((term) => (
              <motion.tr
                key={term.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="border-b hover:bg-muted/30"
              >
                <td className="px-6 py-3 font-medium">{term.sourceTerm}</td>
                <td className="px-6 py-3">{term.targetTerm}</td>
                <td className="px-6 py-3">
                  <TermTypeBadge type={term.termType} />
                </td>
                {isAdvanced && (
                  <td className="px-6 py-3 text-sm text-muted-foreground">
                    {term.gender || '-'}
                  </td>
                )}
                {isAdvanced && (
                  <td className="px-6 py-3 text-sm text-muted-foreground">
                    {term.usageCount}
                  </td>
                )}
                <td className="px-6 py-3">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => onEdit(term)}>
                      <EditIcon className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDelete(term)}
                      className="hover:text-destructive"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </motion.tr>
            ))}
          </AnimatePresence>
        </tbody>
      </table>
    </div>
  )
}

interface TermDialogProps {
  open: boolean
  term: GlossaryTerm | null
  onClose: () => void
  onSave: (data: Partial<GlossaryTerm>) => Promise<void>
}

function TermDialog({ open, term, onClose, onSave }: TermDialogProps): JSX.Element {
  const [formData, setFormData] = useState({
    sourceTerm: '',
    targetTerm: '',
    termType: 'other' as TermType,
    gender: undefined as string | undefined,
    notes: ''
  })
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (term) {
      setFormData({
        sourceTerm: term.sourceTerm,
        targetTerm: term.targetTerm,
        termType: term.termType,
        gender: term.gender,
        notes: term.notes || ''
      })
    } else {
      setFormData({
        sourceTerm: '',
        targetTerm: '',
        termType: 'other',
        gender: undefined,
        notes: ''
      })
    }
  }, [term, open])

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setIsSaving(true)
    try {
      await onSave(formData)
    } catch (error) {
      console.error('Failed to save term:', error)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{term ? 'Edit Term' : 'Add Term'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sourceTerm">Source Term</Label>
              <Input
                id="sourceTerm"
                value={formData.sourceTerm}
                onChange={(e) => setFormData({ ...formData, sourceTerm: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="targetTerm">Translation</Label>
              <Input
                id="targetTerm"
                value={formData.targetTerm}
                onChange={(e) => setFormData({ ...formData, targetTerm: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={formData.termType}
                onValueChange={(v) => setFormData({ ...formData, termType: v as TermType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TERM_TYPES.filter((t) => t.value !== 'all').map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Gender</Label>
              <Select
                value={formData.gender || 'none'}
                onValueChange={(v) =>
                  setFormData({ ...formData, gender: v === 'none' ? undefined : v })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="neutral">Neutral</SelectItem>
                  <SelectItem value="unknown">Unknown</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full rounded-md border bg-transparent px-3 py-2 text-sm"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================================ 
// Glossary Run Panel
// ============================================================================

interface GlossaryRunPanelProps {
  projectId: string | null
  chapters: Chapter[]
  isLoadingChapters: boolean
  onRunComplete?: (result: GlossaryRunResult) => void
}

function GlossaryRunPanel({
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
    return window.api.on.glossaryRunProgress((event) => {
      if (event.projectId !== projectId) return
      setRunProgress({ current: event.current, total: event.total })
    })
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

// ============================================================================ 
// Suggestions Review
// ============================================================================

interface SuggestionReviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  suggestions: GlossarySuggestion[]
  terms: GlossaryTerm[]
  onAccept: (id: string) => Promise<GlossaryTerm>
  onReject: (id: string) => Promise<void>
  onMerge: (suggestionId: string, existingTermId: string) => Promise<void>
  projectId: string | null
}

function SuggestionReviewDialog({
  open,
  onOpenChange,
  suggestions,
  terms,
  onAccept,
  onReject,
  onMerge,
  projectId
}: SuggestionReviewDialogProps): JSX.Element {
  const [query, setQuery] = useState('')
  const [mergeTargets, setMergeTargets] = useState<Record<string, string>>({})

  const handleAccept = async (id: string): Promise<void> => {
    try {
      await onAccept(id)
      toast.success('Suggestion accepted')
    } catch (error) {
      toast.error('Failed to accept suggestion')
    }
  }

  const handleReject = async (id: string): Promise<void> => {
    try {
      await onReject(id)
      toast.success('Suggestion rejected')
    } catch (error) {
      toast.error('Failed to reject suggestion')
    }
  }

  const handleMerge = async (suggestionId: string, existingTermId: string): Promise<void> => {
    try {
      await onMerge(suggestionId, existingTermId)
      setMergeTargets((prev) => {
        const next = { ...prev }
        delete next[suggestionId]
        return next
      })
      toast.success('Suggestion merged')
    } catch (error) {
      toast.error('Failed to merge suggestion')
    }
  }

  const filtered = useMemo(() => {
    if (!query) return suggestions
    const q = query.toLowerCase()
    return suggestions.filter(
      (s) =>
        s.sourceTerm.toLowerCase().includes(q) ||
        s.suggestedTarget.toLowerCase().includes(q) ||
        s.sourceContext.toLowerCase().includes(q)
    )
  }, [query, suggestions])

  if (!projectId) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review Suggestions</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Select a project to review suggestions.
          </p>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Review Suggestions</DialogTitle>
          <DialogDescription>
            Accept, reject, or merge extracted terms into your glossary.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between gap-4">
          <Input
            placeholder="Search suggestions..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="max-w-sm"
          />
          <span className="text-xs text-muted-foreground">
            {filtered.length} of {suggestions.length}
          </span>
        </div>

        <ScrollArea className="h-[480px] rounded-lg border">
          <div className="divide-y">
            {filtered.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground">No suggestions match your search.</div>
            ) : (
              filtered.map((suggestion) => (
                <div key={suggestion.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{suggestion.sourceTerm}</span>
                        <TermTypeBadge type={suggestion.termType} />
                        <span className="text-xs text-muted-foreground">
                          {(suggestion.confidence * 100).toFixed(0)}% confident
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Suggested: <span className="font-medium text-foreground">{suggestion.suggestedTarget}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">{suggestion.sourceContext}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleReject(suggestion.id)}
                        className="hover:text-destructive"
                      >
                        Reject
                      </Button>
                      <Button size="sm" onClick={() => handleAccept(suggestion.id)}>
                        Accept
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Select
                      value={mergeTargets[suggestion.id] || ''}
                      onValueChange={(value) =>
                        setMergeTargets((prev) => ({ ...prev, [suggestion.id]: value }))
                      }
                    >
                      <SelectTrigger className="w-72">
                        <SelectValue placeholder="Merge into existing term..." />
                      </SelectTrigger>
                      <SelectContent>
                        {terms.map((term) => (
                          <SelectItem key={term.id} value={term.id}>
                            {term.sourceTerm} → {term.targetTerm}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!mergeTargets[suggestion.id]}
                      onClick={() => handleMerge(suggestion.id, mergeTargets[suggestion.id])}
                    >
                      Merge
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}

function TermTypeBadge({ type }: { type: TermType }): JSX.Element {
  const colors: Record<TermType, string> = {
    name: 'bg-blue-500/10 text-blue-600',
    place: 'bg-green-500/10 text-green-600',
    skill: 'bg-purple-500/10 text-purple-600',
    item: 'bg-orange-500/10 text-orange-600',
    honorific: 'bg-pink-500/10 text-pink-600',
    other: 'bg-gray-500/10 text-gray-600'
  }

  return (
    <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', colors[type])}>
      {type}
    </span>
  )
}

function EmptyState({ onAdd }: { onAdd: () => void }): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="rounded-full bg-muted p-4">
        <BookIcon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="mt-4 text-lg font-medium">No glossary terms</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Add terms to ensure consistent translations
      </p>
      <Button onClick={onAdd} className="mt-4">
        <PlusIcon className="mr-2 h-4 w-4" />
        Add First Term
      </Button>
    </div>
  )
}

// Icons
function PlusIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  )
}

function EditIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
      />
    </svg>
  )
}

function TrashIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  )
}

function ExportIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  )
}

function ImportIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
      />
    </svg>
  )
}

function BookIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
      />
    </svg>
  )
}
