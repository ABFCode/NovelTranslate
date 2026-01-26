import { useState, useEffect } from 'react'
import { Settings, Key, Palette, Zap, Save } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
// import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { AppSettings, ProviderInfo } from '@shared/types'

export function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [providers, setProviders] = useState<ProviderInfo[]>([])
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({})
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    loadSettings()
    loadProviders()
  }, [])

  const loadSettings = async () => {
    // Check if API is available
    if (!window.api) {
      console.error('window.api is not available')
      toast.error('API not available - preload script may have failed')
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
    // Check if API is available
    if (!window.api) {
      console.error('window.api is not available')
      return
    }

    try {
      const p = await window.api.provider.list()
      setProviders(p)
    } catch (error) {
      console.error('Failed to load providers:', error)
      toast.error(`Failed to load providers: ${error}`)
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

  const handleSaveApiKey = async (providerId: string) => {
    const key = apiKeys[providerId]
    if (!key) return

    try {
      await window.api.apiKey.save(providerId, key)
      toast.success(`API key saved for ${providerId}`)
      setApiKeys((prev) => ({ ...prev, [providerId]: '' }))
    } catch (error) {
      toast.error('Failed to save API key')
    }
  }

  if (!settings) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Loading settings...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-8">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Settings className="h-6 w-6" />
          Settings
        </h1>
        <p className="mt-1 text-muted-foreground">
          Configure your API keys and app preferences
        </p>
      </div>

      <Tabs defaultValue="api-keys" className="w-full">
        <TabsList>
          <TabsTrigger value="api-keys" className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            API Keys
          </TabsTrigger>
          <TabsTrigger value="appearance" className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            Appearance
          </TabsTrigger>
          <TabsTrigger value="performance" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Performance
          </TabsTrigger>
        </TabsList>

        <TabsContent value="api-keys" className="mt-6">
          <div className="grid gap-6">
            {providers.map((provider) => (
              <Card key={provider.id}>
                <CardHeader>
                  <CardTitle>{provider.name}</CardTitle>
                  <CardDescription>
                    Configure your {provider.name} API key for translations
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <Label htmlFor={`api-key-${provider.id}`}>API Key</Label>
                      <Input
                        id={`api-key-${provider.id}`}
                        type="password"
                        placeholder="Enter your API key"
                        value={apiKeys[provider.id] || ''}
                        onChange={(e) =>
                          setApiKeys((prev) => ({ ...prev, [provider.id]: e.target.value }))
                        }
                      />
                    </div>
                    <div className="flex items-end">
                      <Button
                        onClick={() => handleSaveApiKey(provider.id)}
                        disabled={!apiKeys[provider.id]}
                      >
                        <Save className="mr-2 h-4 w-4" />
                        Save
                      </Button>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Available models: {provider.models.map((m) => m.name).join(', ')}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="appearance" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Theme</CardTitle>
              <CardDescription>Choose your preferred color theme</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <Label>Theme</Label>
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
        </TabsContent>

        <TabsContent value="performance" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Translation Settings</CardTitle>
              <CardDescription>Configure translation performance</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
                  <SelectTrigger className="w-20">
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

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <Label>Default Provider</Label>
                  <p className="text-sm text-muted-foreground">
                    Provider to use for new translation configs
                  </p>
                </div>
                <Select
                  value={settings.defaultProviderId || ''}
                  onValueChange={(value) =>
                    setSettings({ ...settings, defaultProviderId: value || undefined })
                  }
                >
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {providers.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <div className="mt-4 flex justify-end">
            <Button onClick={handleSaveSettings} disabled={isSaving}>
              <Save className="mr-2 h-4 w-4" />
              {isSaving ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
