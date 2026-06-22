import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export interface OverrideDraft {
  id?: string
  sourceSegment: string
  originalTranslation: string
  overrideTranslation: string
  scope: 'chapter' | 'project' | 'global'
  reason: string
}

interface OverrideDialogProps {
  draft: OverrideDraft | null
  onDraftChange: (draft: OverrideDraft | null) => void
  onSave: () => Promise<void>
}

export function OverrideDialog({ draft, onDraftChange, onSave }: OverrideDialogProps): JSX.Element {
  return (
    <Dialog open={draft !== null} onOpenChange={(open) => !open && onDraftChange(null)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Translation Override</DialogTitle>
          <DialogDescription>
            Save a manual correction for this segment. Overrides take priority over translation
            memory.
          </DialogDescription>
        </DialogHeader>
        {draft && (
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground">Source Segment</Label>
              <div className="mt-1 rounded-md border bg-muted/30 p-3 text-sm whitespace-pre-wrap">
                {draft.sourceSegment}
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Original Translation</Label>
              <div className="mt-1 rounded-md border bg-muted/30 p-3 text-sm whitespace-pre-wrap">
                {draft.originalTranslation || 'No translation yet'}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Override Translation</Label>
              <textarea
                rows={4}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={draft.overrideTranslation}
                onChange={(e) => onDraftChange({ ...draft, overrideTranslation: e.target.value })}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Scope</Label>
                <Select
                  value={draft.scope}
                  onValueChange={(value) =>
                    onDraftChange({
                      ...draft,
                      scope: value as 'chapter' | 'project' | 'global',
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
                  value={draft.reason}
                  onChange={(e) => onDraftChange({ ...draft, reason: e.target.value })}
                  placeholder="e.g., preferred name"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onDraftChange(null)}>
                Cancel
              </Button>
              <Button onClick={onSave} disabled={!draft.overrideTranslation.trim()}>
                Save Override
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
