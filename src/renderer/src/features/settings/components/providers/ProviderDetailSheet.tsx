import { useEffect, useState } from 'react'
import { Trash2, RefreshCw, Plus, X } from 'lucide-react'
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
import type {
  ProviderConfig,
  ProviderInfoExtended,
  BuiltinProviderTemplate,
  ModelInfo
} from '@shared/types'

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
  const [models, setModels] = useState<ModelInfo[]>([])
  const [newModelId, setNewModelId] = useState('')
  const [newModelName, setNewModelName] = useState('')
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    if (open && provider) {
      setModels(provider.models)
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

  // Changes auto-save: toggles apply immediately, text fields save on blur.
  const persistSettings = async (patch: Partial<ProviderConfig>) => {
    if (!config) return
    try {
      await window.api.providerConfig.update(config.id, patch)
      onChanged()
    } catch (error) {
      toast.error('Failed to update provider')
      console.error(error)
    }
  }

  const handleNameBlur = () => {
    if (!config) return
    const next = displayName.trim()
    if (!next) {
      setDisplayName(config.displayName) // don't allow an empty name; revert
      return
    }
    if (next !== config.displayName) {
      persistSettings({ displayName: next })
    }
  }

  const handleBaseUrlBlur = () => {
    if (!config) return
    const next = baseUrl.trim()
    if (next !== (config.baseUrl ?? '')) {
      // Empty string clears the override (builtins fall back to the template URL).
      persistSettings({ baseUrl: next })
    }
  }

  const handleToggleEnabled = (checked: boolean) => {
    setIsEnabled(checked)
    persistSettings({ isEnabled: checked })
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

  const persistModels = async (next: ModelInfo[]) => {
    if (!config) return
    setModels(next)
    try {
      await window.api.providerConfig.update(config.id, { customModels: next })
      onChanged()
    } catch (error) {
      toast.error('Failed to update models')
      console.error(error)
    }
  }

  const handleRefreshModels = async () => {
    if (!config) return
    setIsRefreshing(true)
    try {
      // No key passed: the main process uses a stored key for this provider.
      const fetched = await window.api.providerConfig.fetchModels(config.id)
      if (fetched.length === 0) {
        toast.warning('No models returned. Add a valid API key, or add models manually below.')
      } else {
        await persistModels(fetched)
        toast.success(`Loaded ${fetched.length} models from provider`)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to fetch models')
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleAddModel = () => {
    const id = newModelId.trim()
    if (!id) return
    if (models.some((m) => m.id === id)) {
      toast.error('That model is already in the list')
      return
    }
    persistModels([...models, { id, name: newModelName.trim() || id, contextWindow: 8192 }])
    setNewModelId('')
    setNewModelName('')
  }

  const handleRemoveModel = (id: string) => {
    persistModels(models.filter((m) => m.id !== id))
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
                <Input
                  id="pd-name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  onBlur={handleNameBlur}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="pd-baseurl">Base URL</Label>
                <Input
                  id="pd-baseurl"
                  value={baseUrl}
                  disabled={!baseUrlEditable}
                  placeholder={template?.defaultBaseUrl || 'https://api.example.com/v1'}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  onBlur={handleBaseUrlBlur}
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
                <Switch checked={isEnabled} onCheckedChange={handleToggleEnabled} />
              </div>
            </section>

            <Separator />

            {/* Models */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">Models</h4>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefreshModels}
                  disabled={isRefreshing}
                  title="Fetch the current model list from the provider using a saved key"
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                  {isRefreshing ? 'Refreshing...' : 'Refresh from provider'}
                </Button>
              </div>

              {models.length === 0 ? (
                <p className="rounded-lg border border-dashed p-3 text-center text-sm text-muted-foreground">
                  No models yet. Refresh from the provider or add one manually.
                </p>
              ) : (
                <div className="space-y-1">
                  {models.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm"
                    >
                      <span className="flex-1 truncate">
                        {m.name}
                        {m.name !== m.id && (
                          <span className="ml-2 text-xs text-muted-foreground">{m.id}</span>
                        )}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => handleRemoveModel(m.id)}
                        title="Remove model"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <Input
                  placeholder="Model ID (e.g. gpt-5.5)"
                  value={newModelId}
                  onChange={(e) => setNewModelId(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddModel()
                  }}
                />
                <Input
                  placeholder="Display name (optional)"
                  value={newModelName}
                  onChange={(e) => setNewModelName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddModel()
                  }}
                />
                <Button variant="outline" onClick={handleAddModel} disabled={!newModelId.trim()}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
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
