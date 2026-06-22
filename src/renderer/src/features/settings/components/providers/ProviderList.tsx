import type { KeyValidationResult, ProviderInfoExtended } from '@shared/types'
import { Cloud, Plus, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ValidationResultsDialog } from '../ValidationResultsDialog'
import { AddProviderDialog } from './AddProviderDialog'
import { ProviderCard } from './ProviderCard'
import { ProviderDetailSheet } from './ProviderDetailSheet'

export function ProviderList() {
  const [providers, setProviders] = useState<ProviderInfoExtended[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [selected, setSelected] = useState<ProviderInfoExtended | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [isValidatingAll, setIsValidatingAll] = useState(false)
  const [validationResults, setValidationResults] = useState<KeyValidationResult[]>([])
  const [validationOpen, setValidationOpen] = useState(false)

  const load = async () => {
    try {
      const list = await window.api.providerConfig.list()
      setProviders(list)
      // Keep the open detail sheet in sync with refreshed data
      setSelected((prev) =>
        prev ? (list.find((p) => p.configId === prev.configId) ?? prev) : prev
      )
    } catch (error) {
      console.error('Failed to load providers:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const handleValidateAll = async () => {
    setIsValidatingAll(true)
    try {
      const results = await window.api.apiKey.validateAll()
      setValidationResults(results)
      setValidationOpen(true)
      load()
    } catch (error) {
      toast.error('Failed to validate keys')
      console.error(error)
    } finally {
      setIsValidatingAll(false)
    }
  }

  const hasAnyKeys = providers.some((p) => p.keyCount > 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Configured Providers</h3>
          <p className="text-sm text-muted-foreground">
            Add LLM providers and manage their API keys.
          </p>
        </div>
        <div className="flex gap-2">
          {hasAnyKeys && (
            <Button variant="outline" onClick={handleValidateAll} disabled={isValidatingAll}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isValidatingAll ? 'animate-spin' : ''}`} />
              {isValidatingAll ? 'Validating...' : 'Validate All Keys'}
            </Button>
          )}
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Provider
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : providers.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-12 text-center">
          <Cloud className="h-8 w-8 text-muted-foreground" />
          <div>
            <p className="font-medium">No providers configured</p>
            <p className="text-sm text-muted-foreground">Add a provider to start translating.</p>
          </div>
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Provider
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {providers.map((provider) => (
            <ProviderCard
              key={provider.configId}
              provider={provider}
              onClick={() => {
                setSelected(provider)
                setDetailOpen(true)
              }}
            />
          ))}
        </div>
      )}

      <AddProviderDialog open={addOpen} onOpenChange={setAddOpen} onCreated={load} />
      <ProviderDetailSheet
        provider={selected}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onChanged={load}
      />
      <ValidationResultsDialog
        results={validationResults}
        providers={providers}
        open={validationOpen}
        onOpenChange={setValidationOpen}
      />
    </div>
  )
}
