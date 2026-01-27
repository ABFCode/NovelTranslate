import { useEffect, useState } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { motion, AnimatePresence } from 'motion/react'
import { useConfigsStore } from './configs.store'
import { useFeatureMode } from '@/contexts/UIModeContext'
import { ShowAdvancedToggle, AdvancedSection } from '@/components/ModeToggle'
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
import { Separator } from '@/components/ui/separator'
import { translationConfigSchema, type TranslationConfigFormData } from '../../../../shared/validation'
import type {
  TranslationConfig,
  ConfigFallback,
  ProviderInfo,
  FallbackConditionType
} from '../../../../shared/types'

const CONDITION_TYPES: { value: FallbackConditionType; label: string }[] = [
  { value: 'any', label: 'Any Error' },
  { value: 'content_block', label: 'Content Blocked' },
  { value: 'rate_limit', label: 'Rate Limit' },
  { value: 'timeout', label: 'Timeout' },
  { value: 'auth_error', label: 'Auth Error' },
  { value: 'quota_exceeded', label: 'Quota Exceeded' },
  { value: 'context_length', label: 'Context Too Long' },
  { value: 'network_error', label: 'Network Error' }
]

export function ConfigBuilder(): JSX.Element {
  const navigate = useNavigate()
  const params = useParams({ strict: false })
  const configId = (params as { id?: string }).id
  const isNew = configId === 'new' || !configId

  const { isAdvanced } = useFeatureMode('configs')
  const { configs, selectedConfig, isSaving, fetchConfigs, selectConfig, createConfig, updateConfig } =
    useConfigsStore()

  const [providers, setProviders] = useState<ProviderInfo[]>([])

  const form = useForm<TranslationConfigFormData>({
    resolver: zodResolver(translationConfigSchema),
    defaultValues: {
      name: '',
      providerId: 'openai',
      modelId: 'gpt-4o-mini',
      systemPrompt: '',
      userPromptTemplate:
        'Translate the following text from {{sourceLanguage}} to {{targetLanguage}}:\n\n{{text}}',
      temperature: 0.7,
      maxTokens: undefined
    }
  })

  // Fetch providers on mount
  useEffect(() => {
    window.api.provider.list().then(setProviders).catch(console.error)
    fetchConfigs()
  }, [fetchConfigs])

  // Load existing config
  useEffect(() => {
    if (!isNew && configId) {
      selectConfig(configId)
    } else {
      selectConfig(null)
    }
  }, [configId, isNew, selectConfig])

  // Populate form with existing config
  useEffect(() => {
    if (selectedConfig) {
      form.reset({
        name: selectedConfig.name,
        providerId: selectedConfig.providerId,
        modelId: selectedConfig.modelId,
        systemPrompt: selectedConfig.systemPrompt,
        userPromptTemplate: selectedConfig.userPromptTemplate,
        temperature: selectedConfig.temperature,
        maxTokens: selectedConfig.maxTokens ?? undefined
      })
    }
  }, [selectedConfig, form])

  const selectedProvider = providers.find((p) => p.id === form.watch('providerId'))

  const handleSave = async (data: TranslationConfigFormData): Promise<void> => {
    try {
      if (isNew) {
        const newConfig = await createConfig({
          name: data.name,
          providerId: data.providerId,
          modelId: data.modelId,
          systemPrompt: data.systemPrompt,
          userPromptTemplate: data.userPromptTemplate,
          temperature: data.temperature,
          maxTokens: data.maxTokens ?? undefined
        })
        navigate({ to: '/configs/$id', params: { id: newConfig.id } })
      } else if (configId) {
        await updateConfig(configId, {
          name: data.name,
          providerId: data.providerId,
          modelId: data.modelId,
          systemPrompt: data.systemPrompt,
          userPromptTemplate: data.userPromptTemplate,
          temperature: data.temperature,
          maxTokens: data.maxTokens ?? undefined
        })
      }
    } catch (error) {
      console.error('Failed to save config:', error)
    }
  }

  const handleCancel = (): void => {
    navigate({ to: '/configs' })
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-6 py-4">
        <div>
          <h1 className="text-2xl font-semibold">{isNew ? 'New Config' : 'Edit Config'}</h1>
          <p className="text-sm text-muted-foreground">
            {isNew ? 'Create a new translation configuration' : selectedConfig?.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={form.handleSubmit(handleSave)} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <form className="mx-auto max-w-3xl space-y-6">
          {/* Basic Info */}
          <section className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Config Name</Label>
              <Input id="name" {...form.register('name')} placeholder="My Translation Config" />
              {form.formState.errors.name && (
                <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Provider</Label>
                <Select
                  value={form.watch('providerId')}
                  onValueChange={(value) => {
                    form.setValue('providerId', value)
                    // Reset model when provider changes
                    const provider = providers.find((p) => p.id === value)
                    if (provider?.models.length) {
                      form.setValue('modelId', provider.models[0].id)
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {providers.map((provider) => (
                      <SelectItem key={provider.id} value={provider.id}>
                        {provider.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Model</Label>
                <Select
                  value={form.watch('modelId')}
                  onValueChange={(value) => form.setValue('modelId', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedProvider?.models.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        {model.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Temperature: {form.watch('temperature')}</Label>
              </div>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={form.watch('temperature')}
                onChange={(e) => form.setValue('temperature', parseFloat(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>More focused</span>
                <span>More creative</span>
              </div>
            </div>
          </section>

          {/* Simple mode: backup config dropdown */}
          {!isAdvanced && !isNew && selectedConfig && (
            <section className="space-y-4">
              <Separator />
              <BackupConfigSelector
                currentConfigId={selectedConfig.id}
                fallbacks={selectedConfig.fallbacks}
                configs={configs}
              />
            </section>
          )}

          {/* Show advanced toggle in simple mode */}
          {!isAdvanced && <ShowAdvancedToggle feature="configs" className="mt-4" />}

          {/* Advanced: Prompts */}
          <AdvancedSection feature="configs" title="Prompts">
            <div className="space-y-4 rounded-lg border p-4">
              <div className="space-y-2">
                <Label htmlFor="systemPrompt">System Prompt</Label>
                <textarea
                  id="systemPrompt"
                  {...form.register('systemPrompt')}
                  rows={5}
                  className="w-full rounded-md border bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="You are a professional translator..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="userPromptTemplate">User Prompt Template</Label>
                <textarea
                  id="userPromptTemplate"
                  {...form.register('userPromptTemplate')}
                  rows={5}
                  className="w-full rounded-md border bg-transparent px-3 py-2 text-sm font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                {form.formState.errors.userPromptTemplate && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.userPromptTemplate.message}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Available variables: {'{{text}}'}, {'{{sourceLanguage}}'}, {'{{targetLanguage}}'}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxTokens">Max Tokens (optional)</Label>
                <Input
                  id="maxTokens"
                  type="number"
                  {...form.register('maxTokens', { valueAsNumber: true })}
                  placeholder="Leave empty for model default"
                />
              </div>
            </div>
          </AdvancedSection>

          {/* Advanced: Fallback Chain */}
          {!isNew && selectedConfig && (
            <AdvancedSection feature="configs" title="Fallback Chain">
              <FallbackChainEditor
                configId={selectedConfig.id}
                fallbacks={selectedConfig.fallbacks}
                availableConfigs={configs.filter((c) => c.id !== selectedConfig.id)}
              />
            </AdvancedSection>
          )}
        </form>
      </div>
    </div>
  )
}

// ============================================================================
// Sub-components
// ============================================================================

interface BackupConfigSelectorProps {
  currentConfigId: string
  fallbacks: ConfigFallback[]
  configs: TranslationConfig[]
}

function BackupConfigSelector({
  currentConfigId,
  fallbacks,
  configs
}: BackupConfigSelectorProps): JSX.Element {
  const { addFallback, deleteFallback } = useConfigsStore()
  const availableConfigs = configs.filter((c) => c.id !== currentConfigId)

  // In simple mode, we only show the first "any" condition fallback
  const anyFallback = fallbacks.find((f) => f.conditionType === 'any')

  const handleChange = async (value: string): Promise<void> => {
    // Remove existing any fallback if it exists
    if (anyFallback) {
      await deleteFallback(anyFallback.id)
    }

    // Add new fallback if a config was selected
    if (value && value !== 'none') {
      await addFallback(currentConfigId, value, 0, 'any')
    }
  }

  return (
    <div className="space-y-2">
      <Label>Backup Config (if this fails)</Label>
      <Select value={anyFallback?.fallbackConfigId || 'none'} onValueChange={handleChange}>
        <SelectTrigger>
          <SelectValue placeholder="No backup" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">No backup</SelectItem>
          {availableConfigs.map((config) => (
            <SelectItem key={config.id} value={config.id}>
              {config.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        If this config fails, automatically try the backup config
      </p>
    </div>
  )
}

interface FallbackChainEditorProps {
  configId: string
  fallbacks: ConfigFallback[]
  availableConfigs: TranslationConfig[]
}

function FallbackChainEditor({
  configId,
  fallbacks,
  availableConfigs
}: FallbackChainEditorProps): JSX.Element {
  const { addFallback, updateFallback, deleteFallback } = useConfigsStore()
  const [isAdding, setIsAdding] = useState(false)

  const sortedFallbacks = [...fallbacks].sort((a, b) => a.priority - b.priority)

  const handleAdd = async (fallbackConfigId: string, conditionType: FallbackConditionType): Promise<void> => {
    const maxPriority = Math.max(...fallbacks.map((f) => f.priority), -1)
    await addFallback(configId, fallbackConfigId, maxPriority + 1, conditionType)
    setIsAdding(false)
  }

  const handleDelete = async (id: string): Promise<void> => {
    await deleteFallback(id)
  }

  const handleUpdateCondition = async (id: string, conditionType: FallbackConditionType): Promise<void> => {
    await updateFallback(id, { conditionType })
  }

  return (
    <div className="space-y-4 rounded-lg border p-4">
      {/* Chain visualization */}
      <div className="flex items-center gap-2 text-sm">
        <span className="rounded bg-primary/10 px-2 py-1 font-medium text-primary">
          This Config
        </span>
        {sortedFallbacks.map((fb) => {
          const config = availableConfigs.find((c) => c.id === fb.fallbackConfigId)
          return (
            <motion.div
              key={fb.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-2"
            >
              <ArrowIcon className="h-4 w-4 text-muted-foreground" />
              <span className="rounded bg-muted px-2 py-1">
                {config?.name || 'Unknown'}
                <span className="ml-1 text-xs text-muted-foreground">({fb.conditionType})</span>
              </span>
            </motion.div>
          )
        })}
        {sortedFallbacks.length === 0 && (
          <span className="text-muted-foreground">→ End (no fallbacks)</span>
        )}
      </div>

      {/* Fallback list */}
      <div className="space-y-2">
        <AnimatePresence>
          {sortedFallbacks.map((fb) => {
            const config = availableConfigs.find((c) => c.id === fb.fallbackConfigId)
            return (
              <motion.div
                key={fb.id}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-2 rounded border p-2"
              >
                <span className="text-sm text-muted-foreground">#{fb.priority + 1}</span>
                <span className="flex-1 font-medium">{config?.name || 'Unknown'}</span>
                <Select
                  value={fb.conditionType}
                  onValueChange={(value) => handleUpdateCondition(fb.id, value as FallbackConditionType)}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONDITION_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(fb.id)}>
                  <TrashIcon className="h-4 w-4" />
                </Button>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>

      {/* Add fallback */}
      {isAdding ? (
        <AddFallbackForm
          availableConfigs={availableConfigs}
          existingFallbackIds={fallbacks.map((f) => f.fallbackConfigId)}
          onAdd={handleAdd}
          onCancel={() => setIsAdding(false)}
        />
      ) : (
        <Button variant="outline" size="sm" onClick={() => setIsAdding(true)} className="w-full">
          <PlusIcon className="mr-2 h-4 w-4" />
          Add Fallback
        </Button>
      )}
    </div>
  )
}

interface AddFallbackFormProps {
  availableConfigs: TranslationConfig[]
  existingFallbackIds: string[]
  onAdd: (configId: string, conditionType: FallbackConditionType) => Promise<void>
  onCancel: () => void
}

function AddFallbackForm({
  availableConfigs,
  existingFallbackIds,
  onAdd,
  onCancel
}: AddFallbackFormProps): JSX.Element {
  const [selectedConfigId, setSelectedConfigId] = useState('')
  const [conditionType, setConditionType] = useState<FallbackConditionType>('any')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const unusedConfigs = availableConfigs.filter((c) => !existingFallbackIds.includes(c.id))

  const handleSubmit = async (): Promise<void> => {
    if (!selectedConfigId) return
    setIsSubmitting(true)
    await onAdd(selectedConfigId, conditionType)
    setIsSubmitting(false)
  }

  return (
    <div className="flex gap-2 rounded border bg-muted/50 p-2">
      <Select value={selectedConfigId} onValueChange={setSelectedConfigId}>
        <SelectTrigger className="flex-1">
          <SelectValue placeholder="Select config..." />
        </SelectTrigger>
        <SelectContent>
          {unusedConfigs.map((config) => (
            <SelectItem key={config.id} value={config.id}>
              {config.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={conditionType} onValueChange={(v) => setConditionType(v as FallbackConditionType)}>
        <SelectTrigger className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {CONDITION_TYPES.map((type) => (
            <SelectItem key={type.value} value={type.value}>
              {type.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button size="sm" onClick={handleSubmit} disabled={!selectedConfigId || isSubmitting}>
        Add
      </Button>
      <Button size="sm" variant="ghost" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  )
}

// Icons
function ArrowIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
    </svg>
  )
}

function PlusIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
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
