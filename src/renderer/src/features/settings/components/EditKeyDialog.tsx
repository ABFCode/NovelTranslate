import type { ApiKeyEntry } from '@shared/types'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

interface EditKeyDialogProps {
  keyEntry: ApiKeyEntry | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: () => void
}

export function EditKeyDialog({ keyEntry, open, onOpenChange, onSave }: EditKeyDialogProps) {
  const [label, setLabel] = useState('')
  const [isEnabled, setIsEnabled] = useState(true)
  const [priority, setPriority] = useState(0)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (keyEntry) {
      setLabel(keyEntry.label || '')
      setIsEnabled(keyEntry.isEnabled)
      setPriority(keyEntry.priority)
    }
  }, [keyEntry])

  const handleSave = async () => {
    if (!keyEntry) return

    setIsSaving(true)
    try {
      await window.api.apiKey.updateMeta(keyEntry.id, {
        label: label.trim() || null,
        isEnabled,
        priority,
      })
      toast.success('Key updated successfully')
      onSave()
      onOpenChange(false)
    } catch (error) {
      toast.error('Failed to update key')
      console.error('Failed to update key:', error)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit API Key</DialogTitle>
          <DialogDescription>Update the label and settings for this API key.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="label">Label</Label>
            <Input
              id="label"
              placeholder="e.g., Personal Key, Work Key"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">A friendly name to identify this key</p>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Enabled</Label>
              <p className="text-xs text-muted-foreground">
                Disabled keys won't be used for translations
              </p>
            </div>
            <Switch checked={isEnabled} onCheckedChange={setIsEnabled} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="priority">Priority</Label>
            <Input
              id="priority"
              type="number"
              min={0}
              max={100}
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value))}
            />
            <p className="text-xs text-muted-foreground">
              Lower numbers are used first (0 = highest priority)
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
