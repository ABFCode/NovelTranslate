import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import type { Project, TranslationMemoryEntry, TranslationOverride } from '../../../../shared/types'
import { useMemoryStore } from './memory.store'

const CONFIDENCE_OPTIONS = [
  { label: '1.0', value: 1 },
  { label: '0.8', value: 0.8 },
  { label: '0.5', value: 0.5 },
  { label: '0.2', value: 0.2 },
]

export function TranslationMemoryPage(): JSX.Element {
  const {
    entries,
    overrides,
    stats,
    isLoading,
    selectedProjectId,
    loadEntries,
    loadStats,
    loadOverrides,
    verifyEntry,
    updateConfidence,
    deleteEntry,
    deleteOverride,
    setSelectedProjectId,
  } = useMemoryStore()

  const [projects, setProjects] = useState<Project[]>([])
  const [query, setQuery] = useState('')

  useEffect(() => {
    const loadProjects = async (): Promise<void> => {
      try {
        const list = await window.api.project.list()
        setProjects(list)
      } catch (error) {
        console.error('Failed to load projects:', error)
      }
    }

    loadProjects()
  }, [])

  useEffect(() => {
    loadEntries(selectedProjectId || undefined)
    loadStats(selectedProjectId || undefined)
    loadOverrides(selectedProjectId || undefined)
  }, [selectedProjectId, loadEntries, loadStats, loadOverrides])

  const filteredEntries = useMemo(() => {
    if (!query) return entries
    const q = query.toLowerCase()
    return entries.filter(
      (entry) =>
        entry.sourceText.toLowerCase().includes(q) || entry.targetText.toLowerCase().includes(q)
    )
  }, [entries, query])

  const filteredOverrides = useMemo(() => {
    if (!query) return overrides
    const q = query.toLowerCase()
    return overrides.filter(
      (override) =>
        override.sourceSegment.toLowerCase().includes(q) ||
        override.overrideTranslation.toLowerCase().includes(q)
    )
  }, [overrides, query])

  const handleVerify = async (id: string): Promise<void> => {
    try {
      await verifyEntry(id)
      toast.success('Marked as verified')
    } catch (_error) {
      toast.error('Failed to verify entry')
    }
  }

  const handleConfidence = async (id: string, confidence: number): Promise<void> => {
    try {
      await updateConfidence(id, confidence)
      toast.success('Confidence updated')
    } catch (_error) {
      toast.error('Failed to update confidence')
    }
  }

  const handleDelete = async (id: string): Promise<void> => {
    if (!confirm('Delete this memory entry?')) return
    try {
      await deleteEntry(id)
      toast.success('Memory entry deleted')
    } catch (_error) {
      toast.error('Failed to delete entry')
    }
  }

  const handleDeleteOverride = async (id: string): Promise<void> => {
    if (!confirm('Delete this override?')) return
    try {
      await deleteOverride(id)
      toast.success('Override deleted')
    } catch (_error) {
      toast.error('Failed to delete override')
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-6 py-4">
        <h1 className="text-2xl font-semibold">Translation Memory</h1>
        <p className="text-sm text-muted-foreground">
          Review cached translations and manual overrides.
        </p>
      </div>

      <div className="border-b px-6 py-3 flex flex-wrap items-center gap-4">
        <Input
          placeholder="Search source or translation..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-sm"
        />
        <Select
          value={selectedProjectId || 'all'}
          onValueChange={(value) => setSelectedProjectId(value === 'all' ? null : value)}
        >
          <SelectTrigger className="w-52">
            <SelectValue placeholder="All projects" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All projects</SelectItem>
            {projects.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="ml-auto text-xs text-muted-foreground">
          {filteredEntries.length} memory entries - {filteredOverrides.length} overrides
        </span>
      </div>

      <div className="flex-1 overflow-auto px-6 py-4">
        <Tabs defaultValue="memory" className="space-y-4">
          <TabsList>
            <TabsTrigger value="memory">Memory</TabsTrigger>
            <TabsTrigger value="overrides">Overrides</TabsTrigger>
          </TabsList>

          <TabsContent value="memory" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <StatCard title="Total entries" value={stats?.totalEntries ?? 0} />
              <StatCard title="Verified entries" value={stats?.verifiedEntries ?? 0} />
              <StatCard title="Total uses" value={stats?.totalUsageCount ?? 0} />
            </div>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Memory entries</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[520px]">
                  {isLoading ? (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                      Loading memory entries...
                    </div>
                  ) : filteredEntries.length === 0 ? (
                    <div className="py-12 text-center text-sm text-muted-foreground">
                      No memory entries found.
                    </div>
                  ) : (
                    <table className="w-full">
                      <thead className="sticky top-0 bg-background text-xs text-muted-foreground">
                        <tr className="border-b">
                          <th className="py-2 text-left font-medium">Source</th>
                          <th className="py-2 text-left font-medium">Translation</th>
                          <th className="py-2 text-left font-medium">Confidence</th>
                          <th className="py-2 text-left font-medium">Usage</th>
                          <th className="py-2 text-left font-medium">Model</th>
                          <th className="py-2 text-right font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredEntries.map((entry) => (
                          <MemoryRow
                            key={entry.id}
                            entry={entry}
                            onVerify={handleVerify}
                            onUpdateConfidence={handleConfidence}
                            onDelete={handleDelete}
                          />
                        ))}
                      </tbody>
                    </table>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="overrides">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Manual overrides</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[520px]">
                  {filteredOverrides.length === 0 ? (
                    <div className="py-12 text-center text-sm text-muted-foreground">
                      No overrides for this scope.
                    </div>
                  ) : (
                    <table className="w-full">
                      <thead className="sticky top-0 bg-background text-xs text-muted-foreground">
                        <tr className="border-b">
                          <th className="py-2 text-left font-medium">Source segment</th>
                          <th className="py-2 text-left font-medium">Override</th>
                          <th className="py-2 text-left font-medium">Scope</th>
                          <th className="py-2 text-left font-medium">Created</th>
                          <th className="py-2 text-right font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredOverrides.map((override) => (
                          <OverrideRow
                            key={override.id}
                            override={override}
                            onDelete={handleDeleteOverride}
                          />
                        ))}
                      </tbody>
                    </table>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

function StatCard({ title, value }: { title: string; value: number }): JSX.Element {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{title}</div>
        <div className="text-2xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  )
}

function MemoryRow({
  entry,
  onVerify,
  onUpdateConfidence,
  onDelete,
}: {
  entry: TranslationMemoryEntry
  onVerify: (id: string) => void
  onUpdateConfidence: (id: string, confidence: number) => void
  onDelete: (id: string) => void
}): JSX.Element {
  const confidenceValue = String(entry.confidence)
  const hasPreset = CONFIDENCE_OPTIONS.some((option) => option.value === entry.confidence)

  return (
    <tr className="border-b text-sm">
      <td className="py-3 pr-4 align-top">
        <div className="line-clamp-2 text-foreground">{entry.sourceText}</div>
      </td>
      <td className="py-3 pr-4 align-top">
        <div className="line-clamp-2 text-muted-foreground">{entry.targetText}</div>
      </td>
      <td className="py-3 pr-4 align-top">
        <Select
          value={confidenceValue}
          onValueChange={(value) => onUpdateConfidence(entry.id, Number(value))}
        >
          <SelectTrigger className="h-7 w-20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {!hasPreset && (
              <SelectItem value={confidenceValue}>{entry.confidence.toFixed(2)}</SelectItem>
            )}
            {CONFIDENCE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={String(option.value)}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {entry.manuallyVerified && <div className="mt-1 text-xs text-emerald-600">Verified</div>}
      </td>
      <td className="py-3 pr-4 align-top text-muted-foreground">{entry.usageCount}</td>
      <td className="py-3 pr-4 align-top text-xs text-muted-foreground">{entry.modelId}</td>
      <td className="py-3 text-right align-top">
        <div className="flex justify-end gap-2">
          {!entry.manuallyVerified && (
            <Button size="sm" variant="outline" onClick={() => onVerify(entry.id)}>
              Verify
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="hover:text-destructive"
            onClick={() => onDelete(entry.id)}
          >
            Delete
          </Button>
        </div>
      </td>
    </tr>
  )
}

function OverrideRow({
  override,
  onDelete,
}: {
  override: TranslationOverride
  onDelete: (id: string) => void
}): JSX.Element {
  return (
    <tr className="border-b text-sm">
      <td className="py-3 pr-4 align-top">
        <div className="line-clamp-2 text-foreground">{override.sourceSegment}</div>
      </td>
      <td className="py-3 pr-4 align-top">
        <div className="line-clamp-2 text-muted-foreground">{override.overrideTranslation}</div>
      </td>
      <td className="py-3 pr-4 align-top">
        <span className={cn('rounded-full px-2 py-0.5 text-xs', getScopeColor(override.scope))}>
          {override.scope}
        </span>
      </td>
      <td className="py-3 pr-4 align-top text-xs text-muted-foreground">
        {formatDate(override.createdAt)}
      </td>
      <td className="py-3 text-right align-top">
        <Button
          size="sm"
          variant="ghost"
          className="hover:text-destructive"
          onClick={() => onDelete(override.id)}
        >
          Delete
        </Button>
      </td>
    </tr>
  )
}

function formatDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleDateString()
}

function getScopeColor(scope: TranslationOverride['scope']): string {
  switch (scope) {
    case 'chapter':
      return 'bg-blue-500/10 text-blue-600'
    case 'project':
      return 'bg-emerald-500/10 text-emerald-600'
    case 'global':
      return 'bg-purple-500/10 text-purple-600'
    default:
      return 'bg-gray-500/10 text-gray-600'
  }
}
