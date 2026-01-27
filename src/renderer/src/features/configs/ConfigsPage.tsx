import { useEffect, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { motion, AnimatePresence } from 'motion/react'
import { toast } from 'sonner'
import { useConfigsStore } from './configs.store'
import { useFeatureMode } from '@/contexts/UIModeContext'
import { FeatureModeToggle } from '@/components/ModeToggle'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type { TranslationConfig, PromptTemplate } from '../../../../shared/types'

export function ConfigsPage(): JSX.Element {
  const navigate = useNavigate()
  const { isAdvanced } = useFeatureMode('configs')
  const { configs, templates, isLoading, fetchConfigs, fetchTemplates, deleteConfig, setDefaultConfig } =
    useConfigsStore()

  const [searchQuery, setSearchQuery] = useState('')
  const [showTemplateDialog, setShowTemplateDialog] = useState(false)
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchConfigs()
    fetchTemplates()
  }, [fetchConfigs, fetchTemplates])

  const filteredConfigs = configs.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.providerId.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleCreateNew = (): void => {
    navigate({ to: '/configs/new' })
  }

  const handleEdit = (config: TranslationConfig): void => {
    navigate({ to: '/configs/$id', params: { id: config.id } })
  }

  const handleDelete = async (config: TranslationConfig): Promise<void> => {
    if (confirm(`Delete "${config.name}"? This cannot be undone.`)) {
      await deleteConfig(config.id)
    }
  }

  const handleSetDefault = async (config: TranslationConfig): Promise<void> => {
    await setDefaultConfig(config.id)
  }

  const handleExport = async (): Promise<void> => {
    setIsExporting(true)
    try {
      const exportData = await window.api.config.export(configs.map((c) => c.id))
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `configs-export-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Configs exported')
    } catch (error) {
      toast.error('Failed to export configs')
    } finally {
      setIsExporting(false)
    }
  }

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsImporting(true)
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      const result = await window.api.config.import(data)
      await fetchConfigs()
      toast.success(`Imported ${result.imported} configs, skipped ${result.skipped}`)
      setShowImportDialog(false)
    } catch (error) {
      console.error('Failed to import configs:', error)
      toast.error('Failed to import configs')
    } finally {
      setIsImporting(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Translation Configs</h1>
          <p className="page-subtitle">
            Manage your translation configurations and fallback chains
          </p>
        </div>
        <div className="flex items-center gap-2">
          <FeatureModeToggle feature="configs" />
          <Button variant="outline" onClick={handleExport} disabled={isExporting || configs.length === 0}>
            <ExportIcon className="mr-2 h-4 w-4" />
            {isExporting ? 'Exporting...' : 'Export'}
          </Button>
          <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <ImportIcon className="mr-2 h-4 w-4" />
                Import
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Import Configs</DialogTitle>
                <DialogDescription>
                  Upload a JSON export to restore configs and templates.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleImportFile}
                  className="w-full"
                  disabled={isImporting}
                />
                <p className="text-xs text-muted-foreground">
                  Existing configs with the same IDs will be skipped.
                </p>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
            <DialogTrigger asChild>
              <Button variant="outline">From Template</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create from Template</DialogTitle>
                <DialogDescription>
                  Choose a pre-built template to start with
                </DialogDescription>
              </DialogHeader>
              <TemplateSelector
                templates={templates}
                onSelect={() => setShowTemplateDialog(false)}
              />
            </DialogContent>
          </Dialog>
          <Button onClick={handleCreateNew}>
            <PlusIcon className="mr-2 h-4 w-4" />
            New Config
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="border-b px-6 py-3">
        <Input
          placeholder="Search configs..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-sm"
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : filteredConfigs.length === 0 ? (
          <EmptyState onCreateNew={handleCreateNew} />
        ) : isAdvanced ? (
          <ConfigTable
            configs={filteredConfigs}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onSetDefault={handleSetDefault}
          />
        ) : (
          <ConfigGrid
            configs={filteredConfigs}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onSetDefault={handleSetDefault}
          />
        )}
      </div>
    </div>
  )
}

// ============================================================================
// Sub-components
// ============================================================================

interface ConfigGridProps {
  configs: TranslationConfig[]
  onEdit: (config: TranslationConfig) => void
  onDelete: (config: TranslationConfig) => void
  onSetDefault: (config: TranslationConfig) => void
}

function ConfigGrid({ configs, onEdit, onDelete, onSetDefault }: ConfigGridProps): JSX.Element {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <AnimatePresence>
        {configs.map((config, index) => (
          <motion.div
            key={config.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ delay: index * 0.05 }}
          >
            <Card
              className={cn(
                'cursor-pointer transition-shadow hover:shadow-md',
                config.isDefault && 'ring-2 ring-primary'
              )}
              onClick={() => onEdit(config)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{config.name}</CardTitle>
                    <CardDescription className="text-xs">
                      {getProviderName(config.providerId)} / {config.modelId}
                    </CardDescription>
                  </div>
                  {config.isDefault && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      Default
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Temp: {config.temperature}</span>
                  <div className="flex gap-1">
                    {!config.isDefault && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onSetDefault(config)
                        }}
                        className="rounded p-1 hover:bg-muted"
                        title="Set as default"
                      >
                        <StarIcon className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onDelete(config)
                      }}
                      className="rounded p-1 hover:bg-destructive/10 hover:text-destructive"
                      title="Delete"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

interface ConfigTableProps {
  configs: TranslationConfig[]
  onEdit: (config: TranslationConfig) => void
  onDelete: (config: TranslationConfig) => void
  onSetDefault: (config: TranslationConfig) => void
}

function ConfigTable({ configs, onEdit, onDelete, onSetDefault }: ConfigTableProps): JSX.Element {
  return (
    <div className="rounded-lg border">
      <table className="w-full">
        <thead className="border-b bg-muted/50">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-medium">Name</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Provider</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Model</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Temperature</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
            <th className="px-4 py-3 text-right text-sm font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {configs.map((config) => (
            <tr
              key={config.id}
              className="cursor-pointer border-b transition-colors hover:bg-muted/30"
              onClick={() => onEdit(config)}
            >
              <td className="px-4 py-3 font-medium">{config.name}</td>
              <td className="px-4 py-3 text-sm">{getProviderName(config.providerId)}</td>
              <td className="px-4 py-3 text-sm">{config.modelId}</td>
              <td className="px-4 py-3 text-sm">{config.temperature}</td>
              <td className="px-4 py-3">
                {config.isDefault && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    Default
                  </span>
                )}
              </td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-1">
                  {!config.isDefault && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onSetDefault(config)
                      }}
                      className="rounded p-1 hover:bg-muted"
                      title="Set as default"
                    >
                      <StarIcon className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onDelete(config)
                    }}
                    className="rounded p-1 hover:bg-destructive/10 hover:text-destructive"
                    title="Delete"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

interface TemplateSelectorProps {
  templates: PromptTemplate[]
  onSelect: () => void
}

function TemplateSelector({ templates, onSelect }: TemplateSelectorProps): JSX.Element {
  const navigate = useNavigate()
  const { createFromTemplate } = useConfigsStore()
  const [name, setName] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState<PromptTemplate | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  const handleCreate = async (): Promise<void> => {
    if (!selectedTemplate || !name.trim()) return

    setIsCreating(true)
    try {
      const config = await createFromTemplate(selectedTemplate.id, name.trim())
      onSelect()
      navigate({ to: '/configs/$id', params: { id: config.id } })
    } catch (error) {
      console.error('Failed to create config:', error)
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="max-h-64 space-y-2 overflow-auto">
        {templates.map((template) => (
          <button
            key={template.id}
            onClick={() => setSelectedTemplate(template)}
            className={cn(
              'w-full rounded-lg border p-3 text-left transition-colors',
              selectedTemplate?.id === template.id
                ? 'border-primary bg-primary/5'
                : 'hover:border-primary/50'
            )}
          >
            <div className="font-medium">{template.name}</div>
            {template.description && (
              <div className="mt-1 text-xs text-muted-foreground">{template.description}</div>
            )}
            <div className="mt-2 flex gap-2">
              <span className="rounded bg-muted px-1.5 py-0.5 text-xs">{template.category}</span>
              <span className="rounded bg-muted px-1.5 py-0.5 text-xs">
                Temp: {template.suggestedTemperature}
              </span>
            </div>
          </button>
        ))}
      </div>

      {selectedTemplate && (
        <div className="space-y-2 border-t pt-4">
          <label className="text-sm font-medium">Config Name</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={`My ${selectedTemplate.name}`}
          />
          <Button onClick={handleCreate} disabled={!name.trim() || isCreating} className="w-full">
            {isCreating ? 'Creating...' : 'Create Config'}
          </Button>
        </div>
      )}
    </div>
  )
}

interface EmptyStateProps {
  onCreateNew: () => void
}

function EmptyState({ onCreateNew }: EmptyStateProps): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <SettingsIcon className="h-10 w-10 text-muted-foreground" />
      <h3 className="mt-4 font-semibold">No configs yet</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Create a translation config to get started
      </p>
      <Button onClick={onCreateNew} className="mt-4">
        <PlusIcon className="mr-2 h-4 w-4" />
        New Config
      </Button>
    </div>
  )
}

// ============================================================================
// Helpers
// ============================================================================

function getProviderName(providerId: string): string {
  const names: Record<string, string> = {
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    gemini: 'Google Gemini'
  }
  return names[providerId] || providerId
}

// Icons
function PlusIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  )
}

function ExportIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  )
}

function ImportIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
      />
    </svg>
  )
}

function StarIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
      />
    </svg>
  )
}

function TrashIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  )
}

function SettingsIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  )
}
