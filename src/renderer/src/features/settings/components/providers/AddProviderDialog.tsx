import { useEffect, useState } from 'react'
import { ArrowLeft, Cloud, Server } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CustomProviderForm, type CustomProviderValues } from './CustomProviderForm'
import type { BuiltinProviderTemplate, ModelInfo } from '@shared/types'

interface AddProviderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}

const CUSTOM = 'custom' as const

export function AddProviderDialog({ open, onOpenChange, onCreated }: AddProviderDialogProps) {
  const [templates, setTemplates] = useState<BuiltinProviderTemplate[]>([])
  const [step, setStep] = useState<1 | 2>(1)
  const [selected, setSelected] = useState<BuiltinProviderTemplate | typeof CUSTOM | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [initialKey, setInitialKey] = useState('')
  const [custom, setCustom] = useState<CustomProviderValues>({ displayName: '', baseUrl: '', models: '' })
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (open) {
      window.api.providerConfig.getTemplates().then(setTemplates).catch(console.error)
      reset()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const reset = () => {
    setStep(1)
    setSelected(null)
    setDisplayName('')
    setBaseUrl('')
    setInitialKey('')
    setCustom({ displayName: '', baseUrl: '', models: '' })
  }

  const pickTemplate = (template: BuiltinProviderTemplate) => {
    setSelected(template)
    setDisplayName(template.name)
    setBaseUrl(template.defaultBaseUrl)
    setStep(2)
  }

  const pickCustom = () => {
    setSelected(CUSTOM)
    setStep(2)
  }

  const parseModels = (csv: string): ModelInfo[] =>
    csv
      .split(',')
      .map((m) => m.trim())
      .filter(Boolean)
      .map((id) => ({ id, name: id, contextWindow: 8192 }))

  const handleCreate = async () => {
    const isCustom = selected === CUSTOM
    const name = isCustom ? custom.displayName.trim() : displayName.trim()
    const url = isCustom ? custom.baseUrl.trim() : baseUrl.trim()

    if (!name) {
      toast.error('Display name is required')
      return
    }
    if (isCustom && !url) {
      toast.error('Base URL is required for a custom provider')
      return
    }

    setIsSaving(true)
    try {
      const template = isCustom ? null : (selected as BuiltinProviderTemplate)
      const customModels = isCustom ? parseModels(custom.models) : undefined

      const created = await window.api.providerConfig.create({
        builtinId: template?.id,
        displayName: name,
        // For builtin: only send a base URL if it differs from the template default.
        baseUrl: isCustom
          ? url
          : template && url && url !== template.defaultBaseUrl
            ? url
            : undefined,
        customModels: customModels && customModels.length > 0 ? customModels : undefined
      })

      if (initialKey.trim()) {
        await window.api.apiKey.save(created.id, initialKey.trim())
        const result = await window.api.providerConfig.validateConnection(created.id, initialKey.trim())
        if (result.valid) {
          toast.success(`${name} added and connected`)
        } else {
          toast.warning(`${name} added, but the key could not be validated${result.error ? `: ${result.error}` : ''}`)
        }
      } else {
        toast.success(`${name} added`)
      }

      onCreated()
      onOpenChange(false)
    } catch (error) {
      toast.error('Failed to add provider')
      console.error(error)
    } finally {
      setIsSaving(false)
    }
  }

  const template = selected && selected !== CUSTOM ? selected : null
  const baseUrlEditable = template ? template.supportsBaseUrlOverride : true

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === 2 && (
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setStep(1)}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            Add Provider
          </DialogTitle>
          <DialogDescription>
            {step === 1
              ? 'Choose a built-in provider or configure a custom OpenAI-compatible endpoint.'
              : 'Configure the provider and optionally add an API key.'}
          </DialogDescription>
        </DialogHeader>

        {step === 1 ? (
          <div className="grid grid-cols-2 gap-2 py-2">
            {templates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => pickTemplate(t)}
                className="flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors hover:bg-muted"
              >
                <div className="flex items-center gap-2">
                  <Cloud className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{t.name}</span>
                </div>
                <span className="text-xs text-muted-foreground line-clamp-2">{t.description}</span>
              </button>
            ))}
            <button
              type="button"
              onClick={pickCustom}
              className="col-span-2 flex items-center gap-2 rounded-lg border border-dashed p-3 text-left transition-colors hover:bg-muted"
            >
              <Server className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-sm font-medium">Custom OpenAI-Compatible</div>
                <div className="text-xs text-muted-foreground">
                  Any provider with an OpenAI-compatible API (OpenRouter, Ollama, proxies…)
                </div>
              </div>
            </button>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {selected === CUSTOM ? (
              <CustomProviderForm values={custom} onChange={setCustom} />
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="ap-name">Display Name</Label>
                  <Input
                    id="ap-name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ap-baseurl">Base URL</Label>
                  <Input
                    id="ap-baseurl"
                    value={baseUrl}
                    disabled={!baseUrlEditable}
                    onChange={(e) => setBaseUrl(e.target.value)}
                  />
                  {!baseUrlEditable && (
                    <p className="text-xs text-muted-foreground">
                      This provider does not support a custom base URL.
                    </p>
                  )}
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="ap-key">API Key (optional)</Label>
              <Input
                id="ap-key"
                type="password"
                placeholder="Add now or later"
                value={initialKey}
                onChange={(e) => setInitialKey(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                If provided, the connection will be tested after the provider is added.
              </p>
            </div>
          </div>
        )}

        {step === 2 && (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={isSaving}>
              {isSaving ? 'Adding...' : 'Add Provider'}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
