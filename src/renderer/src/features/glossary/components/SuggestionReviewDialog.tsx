import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { TermTypeBadge } from './TermTypeBadge'
import type { GlossarySuggestion, GlossaryTerm } from '../../../../../shared/types'

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

export function SuggestionReviewDialog({
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
