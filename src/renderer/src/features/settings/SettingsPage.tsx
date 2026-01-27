import { useState, useEffect } from 'react'
import { Settings, Key, Palette, Zap, Save, Plus, Trash2, Check, X, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'motion/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { GlobalModeToggle } from '@/components/ModeToggle'
import { useUIMode } from '@/contexts/UIModeContext'
import { cn } from '@/lib/utils'
import type { AppSettings, ProviderInfo, ApiKeyEntry, TranslationConfig } from '@shared/types'

export function SettingsPage() {
  const { isAdvanced } = useUIMode()
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [providers, setProviders] = useState<ProviderInfo[]>([])
  const [configs, setConfigs] = useState<TranslationConfig[]>([])
  const [apiKeys, setApiKeys] = useState<Record<string, ApiKeyEntry[]>>({})
  const [newKeyInputs, setNewKeyInputs] = useState<Record<string, string>>({})
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    loadSettings()
    loadProviders()
    loadConfigs()
    loadApiKeys()
  }, [])

  const loadSettings = async () => {
    if (!window.api) {
      toast.error('API not available')
      return
    }

    try {
      const s = await window.api.settings.get()
      setSettings(s)
    } catch (error) {
      console.error('Failed to load settings:', error)
      toast.error(`Failed to load settings: ${error}`)
    }
  }

  const loadProviders = async () => {
    if (!window.api) return
    try {
      const p = await window.api.provider.list()
      setProviders(p)
    } catch (error) {
      console.error('Failed to load providers:', error)
    }
  }

  const loadConfigs = async () => {
    if (!window.api) return
    try {
      const c = await window.api.config.list()
      setConfigs(c)
    } catch (error) {
      console.error('Failed to load configs:', error)
    }
  }

  const loadApiKeys = async () => {
    if (!window.api) return
    try {
      const keys = await window.api.apiKey.list()
      const grouped: Record<string, ApiKeyEntry[]> = {}
      for (const key of keys) {
        if (!grouped[key.providerId]) {
          grouped[key.providerId] = []
        }
        grouped[key.providerId].push(key)
      }
      setApiKeys(grouped)
    } catch (error) {
      console.error('Failed to load API keys:', error)
    }
  }

  const handleSaveSettings = async () => {
    if (!settings) return
    setIsSaving(true)
    try {
      await window.api.settings.save(settings)
      toast.success('Settings saved')
    } catch (error) {
      toast.error('Failed to save settings')
    }
    setIsSaving(false)
  }

  const handleAddApiKey = async (providerId: string) => {
    const keyValue = newKeyInputs[providerId]
    if (!keyValue?.trim()) return

    try {
      await window.api.apiKey.save(providerId, keyValue.trim(), undefined, apiKeys[providerId]?.length || 0)
      toast.success(`API key added for ${providerId}`)
      setNewKeyInputs((prev) => ({ ...prev, [providerId]: '' }))
      loadApiKeys()
    } catch (error) {
      toast.error('Failed to add API key')
    }
  }

  const handleDeleteApiKey = async (keyId: string) => {
    if (!confirm('Delete this API key?')) return
    try {
      await window.api.apiKey.delete(keyId)
      toast.success('API key deleted')
      loadApiKeys()
    } catch (error) {
      toast.error('Failed to delete API key')
    }
  }

  const handleValidateKey = async (keyId: string) => {
    try {
      const isValid = await window.api.apiKey.validateStored(keyId)
      if (isValid) {
        toast.success('API key is valid')
      } else {
        toast.error('API key is invalid')
      }
      loadApiKeys()
    } catch (error) {
      toast.error('Failed to validate API key')
    }
  }

  if (!settings) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title flex items-center gap-3">
            <Settings className="h-7 w-7" />
            Settings
          </h1>
          <p className="page-subtitle">Configure your API keys and app preferences</p>
        </div>
        <Button onClick={handleSaveSettings} disabled={isSaving}>
          <Save className="mr-2 h-4 w-4" />
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <Tabs defaultValue="api-keys" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="api-keys" className="flex items-center gap-2">
              <Key className="h-4 w-4" />
              API Keys
            </TabsTrigger>
            <TabsTrigger value="defaults" className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Defaults
            </TabsTrigger>
            <TabsTrigger value="appearance" className="flex items-center gap-2">
              <Palette className="h-4 w-4" />
              Appearance
            </TabsTrigger>
            {isAdvanced() && (
              <TabsTrigger value="advanced" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Advanced
              </TabsTrigger>
            )}
          </TabsList>

          {/* API Keys Tab */}
          <TabsContent value="api-keys" className="mt-6">
            <div className="grid gap-6">
              {providers.map((provider) => (
                <Card key={provider.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>{provider.name}</CardTitle>
                        <CardDescription>
                          {apiKeys[provider.id]?.length || 0} key(s) configured
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Existing keys */}
                    <AnimatePresence>
                      {apiKeys[provider.id]?.map((key, index) => (
                        <motion.div
                          key={key.id}
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="flex items-center gap-2 rounded-lg border p-3"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">
                                {key.label || `Key ${index + 1}`}
                              </span>
                              {key.isValid ? (
                                <span className="rounded bg-green-500/10 px-1.5 py-0.5 text-xs text-green-600">
                                  Valid
                                </span>
                              ) : (
                                <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-xs text-destructive">
                                  Invalid
                                </span>
                              )}
                              {!key.isEnabled && (
                                <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                                  Disabled
                                </span>
                              )}
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {key.requestCount} requests
                              {key.lastUsedAt && ` • Last used ${new Date(key.lastUsedAt).toLocaleDateString()}`}
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleValidateKey(key.id)}
                              title="Validate"
                            >
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteApiKey(key.id)}
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>

                    {/* Add new key */}
                    <div className="flex gap-2">
                      <Input
                        type="password"
                        placeholder={`Enter ${provider.name} API key`}
                        value={newKeyInputs[provider.id] || ''}
                        onChange={(e) =>
                          setNewKeyInputs((prev) => ({ ...prev, [provider.id]: e.target.value }))
                        }
                      />
                      <Button
                        onClick={() => handleAddApiKey(provider.id)}
                        disabled={!newKeyInputs[provider.id]?.trim()}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Add Key
                      </Button>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      Models: {provider.models.map((m) => m.name).join(', ')}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Defaults Tab */}
          <TabsContent value="defaults" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Default Configuration</CardTitle>
                <CardDescription>Set default config for new translations</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Default Config</Label>
                    <p className="text-sm text-muted-foreground">
                      Used when no project-specific config is set
                    </p>
                  </div>
                  <Select
                    value={settings.defaultConfigId || ''}
                    onValueChange={(value) =>
                      setSettings({ ...settings, defaultConfigId: value || undefined })
                    }
                  >
                    <SelectTrigger className="w-60">
                      <SelectValue placeholder="Select default config..." />
                    </SelectTrigger>
                    <SelectContent>
                      {configs.map((config) => (
                        <SelectItem key={config.id} value={config.id}>
                          {config.name}
                          {config.isDefault && ' (current default)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Concurrent Translations</Label>
                    <p className="text-sm text-muted-foreground">
                      Number of chapters to translate simultaneously
                    </p>
                  </div>
                  <Select
                    value={String(settings.translationConcurrency)}
                    onValueChange={(value) =>
                      setSettings({ ...settings, translationConcurrency: Number(value) })
                    }
                  >
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 5, 10].map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Features</CardTitle>
                <CardDescription>Enable or disable optional features</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Translation Memory</Label>
                    <p className="text-sm text-muted-foreground">
                      Cache translations to avoid re-translating identical text
                    </p>
                  </div>
                  <Switch
                    checked={settings.enableTranslationMemory}
                    onCheckedChange={(checked) =>
                      setSettings({ ...settings, enableTranslationMemory: checked })
                    }
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Glossary Injection</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically include glossary terms in translation prompts
                    </p>
                  </div>
                  <Switch
                    checked={settings.enableGlossaryInjection}
                    onCheckedChange={(checked) =>
                      setSettings({ ...settings, enableGlossaryInjection: checked })
                    }
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Cost Estimates</Label>
                    <p className="text-sm text-muted-foreground">
                      Show estimated costs before running translations
                    </p>
                  </div>
                  <Switch
                    checked={settings.showCostEstimates}
                    onCheckedChange={(checked) =>
                      setSettings({ ...settings, showCostEstimates: checked })
                    }
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Appearance Tab */}
          <TabsContent value="appearance" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Theme</CardTitle>
                <CardDescription>Choose your preferred color theme</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <Label>Color Theme</Label>
                  <Select
                    value={settings.theme}
                    onValueChange={(value: 'light' | 'dark' | 'system') =>
                      setSettings({ ...settings, theme: value })
                    }
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="dark">Dark</SelectItem>
                      <SelectItem value="system">System</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>UI Mode</CardTitle>
                <CardDescription>Choose between simple and advanced interface modes</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Interface Mode</Label>
                    <p className="text-sm text-muted-foreground">
                      Simple mode hides advanced options for a cleaner experience
                    </p>
                  </div>
                  <GlobalModeToggle />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Advanced Tab */}
          {isAdvanced() && (
            <TabsContent value="advanced" className="mt-6 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>API Key Rotation</CardTitle>
                  <CardDescription>Configure how multiple API keys are used</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Rotation Strategy</Label>
                      <p className="text-sm text-muted-foreground">
                        How to select which API key to use
                      </p>
                    </div>
                    <Select
                      value={settings.keyRotationStrategy}
                      onValueChange={(value: 'priority' | 'round_robin' | 'least_recently_used') =>
                        setSettings({ ...settings, keyRotationStrategy: value })
                      }
                    >
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="priority">Priority (use highest first)</SelectItem>
                        <SelectItem value="round_robin">Round Robin (distribute evenly)</SelectItem>
                        <SelectItem value="least_recently_used">Least Recently Used</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Auto-Save</CardTitle>
                  <CardDescription>Configure automatic saving behavior</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Auto-Save Interval</Label>
                      <p className="text-sm text-muted-foreground">
                        How often to automatically save work
                      </p>
                    </div>
                    <Select
                      value={String(settings.autoSaveInterval)}
                      onValueChange={(value) =>
                        setSettings({ ...settings, autoSaveInterval: Number(value) })
                      }
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10000">10 seconds</SelectItem>
                        <SelectItem value="30000">30 seconds</SelectItem>
                        <SelectItem value="60000">1 minute</SelectItem>
                        <SelectItem value="300000">5 minutes</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  )
}
