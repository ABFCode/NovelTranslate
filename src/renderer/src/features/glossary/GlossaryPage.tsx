import { Download, Plus, Upload } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { AdvancedSection, FeatureModeToggle } from '@/components/ModeToggle'
import { GlossarySkeleton } from '@/components/Skeleton/GlossarySkeleton'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useFeatureMode } from '@/contexts/UIModeContext'
import type { Chapter, GlossaryTerm, Project, TermType } from '../../../../shared/types'
import {
  EmptyState,
  GlossaryRunPanel,
  SuggestionReviewDialog,
  TermDialog,
  TermTable,
} from './components'
import { useGlossaryStore } from './glossary.store'

const TERM_TYPES: { value: TermType | 'all'; label: string }[] = [
  { value: 'all', label: 'All Types' },
  { value: 'name', label: 'Names' },
  { value: 'place', label: 'Places' },
  { value: 'skill', label: 'Skills' },
  { value: 'item', label: 'Items' },
  { value: 'honorific', label: 'Honorifics' },
  { value: 'other', label: 'Other' },
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
    getFilteredTerms,
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
          <p className="page-subtitle">Manage translation terminology for consistency</p>
        </div>
        <div className="flex items-center gap-2">
          <FeatureModeToggle feature="glossary" />
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Upload className="mr-2 h-4 w-4" />
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
            <Plus className="mr-2 h-4 w-4" />
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
      <AdvancedSection
        feature="glossary"
        className="border-b px-6 py-4"
        title="Glossary Extraction"
      >
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
              sourceTerm: data.sourceTerm,
              targetTerm: data.targetTerm,
              termType: data.termType,
              gender: data.gender,
              notes: data.notes,
              aliases: [],
              projectId: selectedProjectId || null,
              autoGenerated: false,
              confidence: 1.0,
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
