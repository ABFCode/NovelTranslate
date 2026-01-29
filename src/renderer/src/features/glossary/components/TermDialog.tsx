import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import type { GlossaryGender, GlossaryTerm, TermType } from '../../../../../shared/types'

const TERM_TYPES: { value: TermType; label: string }[] = [
  { value: 'name', label: 'Names' },
  { value: 'place', label: 'Places' },
  { value: 'skill', label: 'Skills' },
  { value: 'item', label: 'Items' },
  { value: 'honorific', label: 'Honorifics' },
  { value: 'other', label: 'Other' }
]

interface TermDialogProps {
  open: boolean
  term: GlossaryTerm | null
  onClose: () => void
  onSave: (data: Pick<GlossaryTerm, 'sourceTerm' | 'targetTerm' | 'termType' | 'gender' | 'notes'>) => Promise<void>
}

export function TermDialog({ open, term, onClose, onSave }: TermDialogProps): JSX.Element {
  const [formData, setFormData] = useState({
    sourceTerm: '',
    targetTerm: '',
    termType: 'other' as TermType,
    gender: undefined as GlossaryGender | undefined,
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
                  {TERM_TYPES.map((t) => (
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
                  setFormData({ ...formData, gender: v === 'none' ? undefined : v as GlossaryGender })
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
