import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { KeyManagement } from './KeyManagement'
import type { ProviderConfig, ProviderInfoExtended, BuiltinProviderTemplate } from '@shared/types'

interface ProviderDetailSheetProps {
  provider: ProviderInfoExtended | null
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called when the provider (or its keys) change, to refresh the list */
  onChanged: () => void
}

export function ProviderDetailSheet({ provider, open, onOpenChange, onChanged }: ProviderDetailSheetProps) {
  const [config, setConfig] = useState<ProviderConfig | null>(null)
  const [templates, setTemplates] = useState<BuiltinProviderTemplate[]>([])
  const [displayName, setDisplayName] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [isEnabled, setIsEnabled] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (open && provider) {
      Promise.all([
        window.api.providerConfig.get(provider.configId),
        window.api.providerConfig.getTemplates()
      ])
        .then(([cfg, tmpls]) => {
          setTemplates(tmpls)
          if (cfg) {
            setConfig(cfg)
            setDisplayName(cfg.displayName)
            setBaseUrl(cfg.baseUrl ?? '')
            setIsEnabled(cfg.isEnabled)
          }
        })
        .catch(console.error)
    }
  }, [open, provider])

  if (!provider) return null

  const template =
    config?.providerType === 'builtin' && config.builtinId
      ? templates.find((t) => t.id === config.builtinId)
      : null
  const baseUrlEditable = config?.providerType === 'openai_compatible' || (template?.supportsBaseUrlOverride ?? false)

  const handleSave = async () => {
    if (!config) return
    setIsSaving(true)
    try {
      await window.api.providerConfig.update(config.id, {
        displayName: displayName.trim() || config.displayName,
        baseUrl: baseUrl.trim() || undefined,
        isEnabled
      })
      toast.success('Provider updated')
      onChanged()
    } catch (error) {
      toast.error('Failed to update provider')
      console.error(error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!config) return
    if (!confirm(`Delete "${config.displayName}"? This removes its API keys. Translation configs using it will be blocked.`)) {
      return
    }
    try {
      await window.api.providerConfig.delete(config.id)
      toast.success('Provider deleted')
      onChanged()
      onOpenChange(false)
    } catch (error) {
      toast.error('Failed to delete provider. It may be in use by a translation config.')
      console.error(error)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{provider.name}</DialogTitle>
          <DialogDescription>
            {provider.providerType === 'openai_compatible' ? 'Custom OpenAI-compatible provider' : 'Built-in provider'}
            {' • '}
            {provider.totalRequests.toLocaleString()} requests
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh] pr-4">
          <div className="space-y-6">
            {/* Settings */}
            <section className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pd-name">Display Name</Label>
                <Input id="pd-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="pd-baseurl">Base URL</Label>
                <Input
                  id="pd-baseurl"
                  value={baseUrl}
                  disabled={!baseUrlEditable}
                  placeholder={template?.defaultBaseUrl || 'https://api.example.com/v1'}
                  onChange={(e) => setBaseUrl(e.target.value)}
                />
                {!baseUrlEditable && (
                  <p className="text-xs text-muted-foreground">
                    This provider does not support a custom base URL.
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Enabled</Label>
                  <p className="text-xs text-muted-foreground">
                    Disabled providers can&apos;t be selected for new configs.
                  </p>
                </div>
                <Switch checked={isEnabled} onCheckedChange={setIsEnabled} />
              </div>

              <Button onClick={handleSave} disabled={isSaving || !config}>
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </section>

            <Separator />

            {/* Models */}
            <section className="space-y-2">
              <h4 className="text-sm font-medium">Models</h4>
              {provider.models.length === 0 ? (
                <p className="text-sm text-muted-foreground">No models configured.</p>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {provider.models.map((m) => (
                    <span key={m.id} className="rounded bg-muted px-2 py-0.5 text-xs">
                      {m.name}
                    </span>
                  ))}
                </div>
              )}
            </section>

            <Separator />

            {/* Keys */}
            <section className="space-y-2">
              <h4 className="text-sm font-medium">API Keys</h4>
              <KeyManagement providerConfigId={provider.configId} onKeysChanged={onChanged} />
            </section>

            <Separator />

            {/* Danger zone */}
            <section className="space-y-2">
              <Button variant="destructive" onClick={handleDelete}>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Provider
              </Button>
            </section>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
