import type { AppSettings, TranslationConfig } from '@shared/types'
import { AlertCircle, Check, Cloud, Loader2, Palette, Settings, Zap } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { GlobalModeToggle } from '@/components/ModeToggle'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useUIMode } from '@/contexts/UIModeContext'
import { BackupRestore } from './components/BackupRestore'
import { ProviderList } from './components/providers/ProviderList'

export function SettingsPage() {
  const { isAdvanced } = useUIMode()
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [configs, setConfigs] = useState<TranslationConfig[]>([])
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  useEffect(() => {
    loadSettings()
    loadConfigs()
  }, [])

  // Briefly show the "Saved" confirmation, then fade back to idle.
  useEffect(() => {
    if (saveStatus !== 'saved') return
    const timer = setTimeout(() => setSaveStatus('idle'), 2000)
    return () => clearTimeout(timer)
  }, [saveStatus])

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

  const loadConfigs = async () => {
    if (!window.api) return
    try {
      const c = await window.api.config.list()
      setConfigs(c)
    } catch (error) {
      console.error('Failed to load configs:', error)
    }
  }

  // Settings auto-save: each change is persisted immediately.
  const updateSettings = async (patch: Partial<AppSettings>) => {
    if (!settings) return
    setSettings({ ...settings, ...patch })
    setSaveStatus('saving')
    try {
      const saved = await window.api.settings.save(patch)
      setSettings(saved)
      setSaveStatus('saved')
    } catch (error) {
      setSaveStatus('error')
      toast.error('Failed to save settings')
      console.error('Failed to save settings:', error)
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
          <p className="page-subtitle">Configure your providers and app preferences</p>
        </div>
        <div className="h-5 text-sm text-muted-foreground" aria-live="polite">
          {saveStatus === 'saving' && (
            <span className="flex items-center gap-1.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Saving…
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-green-600" />
              Saved
            </span>
          )}
          {saveStatus === 'error' && (
            <span className="flex items-center gap-1.5 text-destructive">
              <AlertCircle className="h-3.5 w-3.5" />
              Couldn&apos;t save
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <Tabs defaultValue="providers" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="providers" className="flex items-center gap-2">
              <Cloud className="h-4 w-4" />
              Providers
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

          {/* Providers Tab */}
          <TabsContent value="providers" className="mt-6">
            <ProviderList />
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
                      updateSettings({ defaultConfigId: value || undefined })
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
                      updateSettings({ translationConcurrency: Number(value) })
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
                      updateSettings({ enableTranslationMemory: checked })
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
                      updateSettings({ enableGlossaryInjection: checked })
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
                    onCheckedChange={(checked) => updateSettings({ showCostEstimates: checked })}
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
                      updateSettings({ theme: value })
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
                <CardDescription>
                  Choose between simple and advanced interface modes
                </CardDescription>
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
                        updateSettings({ keyRotationStrategy: value })
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
                      onValueChange={(value) => updateSettings({ autoSaveInterval: Number(value) })}
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

              <Card>
                <CardHeader>
                  <CardTitle>Debug & Logging</CardTitle>
                  <CardDescription>Configure logging verbosity and debug options</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Log Level</Label>
                      <p className="text-sm text-muted-foreground">
                        Control the verbosity of log output
                      </p>
                    </div>
                    <Select
                      value={settings.logLevel}
                      onValueChange={(value: 'debug' | 'info' | 'warn' | 'error') =>
                        updateSettings({ logLevel: value })
                      }
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="debug">Debug</SelectItem>
                        <SelectItem value="info">Info</SelectItem>
                        <SelectItem value="warn">Warning</SelectItem>
                        <SelectItem value="error">Error</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>File Logging</Label>
                      <p className="text-sm text-muted-foreground">
                        Save logs to file for troubleshooting
                      </p>
                    </div>
                    <Switch
                      checked={settings.enableFileLogging}
                      onCheckedChange={(checked) => updateSettings({ enableFileLogging: checked })}
                    />
                  </div>
                </CardContent>
              </Card>

              <BackupRestore onSettingsImported={loadSettings} />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  )
}
