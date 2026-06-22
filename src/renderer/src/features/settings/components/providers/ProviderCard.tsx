import type { ProviderInfoExtended } from '@shared/types'
import { AlertCircle, CheckCircle2, Cloud, KeyRound, Server } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface ProviderCardProps {
  provider: ProviderInfoExtended
  onClick: () => void
}

export function ProviderCard({ provider, onClick }: ProviderCardProps) {
  const Icon = provider.providerType === 'openai_compatible' ? Server : Cloud

  return (
    <Card
      className={cn(
        'cursor-pointer transition-shadow hover:shadow-md',
        !provider.isEnabled && 'opacity-60'
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">{provider.name}</CardTitle>
          </div>
          {provider.hasValidKey ? (
            <span className="flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs text-green-600">
              <CheckCircle2 className="h-3 w-3" />
              Connected
            </span>
          ) : provider.keyCount > 0 ? (
            <span className="flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">
              <AlertCircle className="h-3 w-3" />
              Key issue
            </span>
          ) : (
            <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              <KeyRound className="h-3 w-3" />
              No key
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-1 text-xs text-muted-foreground">
        {provider.baseUrl && (
          <p className="truncate" title={provider.baseUrl}>
            {provider.baseUrl}
          </p>
        )}
        <div className="flex items-center justify-between">
          <span>
            {provider.keyCount} {provider.keyCount === 1 ? 'key' : 'keys'}
          </span>
          <span>{provider.totalRequests.toLocaleString()} requests</span>
        </div>
        <p className="truncate">
          {provider.models.length} {provider.models.length === 1 ? 'model' : 'models'}
        </p>
      </CardContent>
    </Card>
  )
}
