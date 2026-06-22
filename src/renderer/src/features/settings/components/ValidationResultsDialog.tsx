import type { KeyValidationResult, ProviderInfoExtended } from '@shared/types'
import { AlertCircle, CheckCircle2, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface ValidationResultsDialogProps {
  results: KeyValidationResult[]
  providers: ProviderInfoExtended[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ValidationResultsDialog({
  results,
  providers,
  open,
  onOpenChange,
}: ValidationResultsDialogProps) {
  const validCount = results.filter((r) => r.isValid).length
  const invalidCount = results.filter((r) => !r.isValid).length

  const getProviderName = (providerConfigId: string) => {
    return providers.find((p) => p.id === providerConfigId)?.name || providerConfigId
  }

  const groupedResults = results.reduce(
    (acc, result) => {
      const providerName = getProviderName(result.providerConfigId)
      if (!acc[providerName]) {
        acc[providerName] = []
      }
      acc[providerName].push(result)
      return acc
    },
    {} as Record<string, KeyValidationResult[]>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Validation Results</DialogTitle>
          <DialogDescription>
            Validated {results.length} key{results.length !== 1 ? 's' : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto py-4">
          {/* Summary */}
          <div className="mb-4 flex gap-4">
            <div className="flex items-center gap-2 rounded-lg bg-green-500/10 px-3 py-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium text-green-600">{validCount} valid</span>
            </div>
            {invalidCount > 0 && (
              <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2">
                <XCircle className="h-4 w-4 text-destructive" />
                <span className="text-sm font-medium text-destructive">{invalidCount} invalid</span>
              </div>
            )}
          </div>

          {/* Results by provider */}
          <div className="space-y-4">
            {Object.entries(groupedResults).map(([providerName, providerResults]) => (
              <div key={providerName} className="space-y-2">
                <h4 className="text-sm font-medium">{providerName}</h4>
                <div className="space-y-1">
                  {providerResults.map((result) => (
                    <div
                      key={result.keyId}
                      className="flex items-center justify-between rounded-lg border p-2"
                    >
                      <div className="flex items-center gap-2">
                        {result.isValid ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-destructive" />
                        )}
                        <span className="text-sm">{result.label || 'Unnamed Key'}</span>
                      </div>
                      {result.error && (
                        <span
                          className="text-xs text-muted-foreground truncate max-w-[200px]"
                          title={result.error}
                        >
                          {result.error}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {results.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <AlertCircle className="h-8 w-8 mb-2" />
              <p>No API keys to validate</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
