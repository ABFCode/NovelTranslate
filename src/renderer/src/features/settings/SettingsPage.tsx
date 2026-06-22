import { useState, useEffect } from 'react'
import { Settings, Cloud, Palette, Zap, Save } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { ProviderList } from './components/providers/ProviderList'
import { BackupRestore } from './components/BackupRestore'
import type { AppSettings, TranslationConfig } from '@shared/types'

export function SettingsPage() {
  const { isAdvanced } = useUIMode()
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [configs, setConfigs] = useState<TranslationConfig[]>([])
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    loadSettings()
    loadConfigs()
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

  const loadConfigs = async () => {
    if (!window.api) return
    try {
      const c = await window.api.config.list()
      setConfigs(c)
    } catch (error) {
      console.error('Failed to load configs:', error)
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
        <Button onClick={handleSaveSettings} disabled={isSaving}>
          <Save className="mr-2 h-4 w-4" />
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
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
                        setSettings({ ...settings, logLevel: value })
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
                      onCheckedChange={(checked) =>
                        setSettings({ ...settings, enableFileLogging: checked })
                      }
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
