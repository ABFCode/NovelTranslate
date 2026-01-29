import { useMemo } from 'react'
import { BarChart3 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { ApiKeyEntry, ProviderInfo } from '@shared/types'

interface KeyUsageStatsProps {
  apiKeys: Record<string, ApiKeyEntry[]>
  providers: ProviderInfo[]
}

export function KeyUsageStats({ apiKeys, providers }: KeyUsageStatsProps) {
  const stats = useMemo(() => {
    const allKeys = Object.values(apiKeys).flat()
    const totalRequests = allKeys.reduce((sum, key) => sum + key.requestCount, 0)
    const maxRequests = Math.max(...allKeys.map((k) => k.requestCount), 1)

    const providerStats = providers.map((provider) => {
      const keys = apiKeys[provider.id] || []
      const providerRequests = keys.reduce((sum, key) => sum + key.requestCount, 0)
      return {
        providerId: provider.id,
        providerName: provider.name,
        totalRequests: providerRequests,
        keyCount: keys.length,
        validKeys: keys.filter((k) => k.isValid && k.isEnabled).length,
        keys: keys.map((key) => ({
          id: key.id,
          label: key.label || `Key ${keys.indexOf(key) + 1}`,
          requestCount: key.requestCount,
          percentage: maxRequests > 0 ? (key.requestCount / maxRequests) * 100 : 0,
          lastUsedAt: key.lastUsedAt,
          isValid: key.isValid,
          isEnabled: key.isEnabled
        }))
      }
    }).filter((p) => p.keyCount > 0)

    return { totalRequests, providerStats, maxRequests }
  }, [apiKeys, providers])

  if (stats.providerStats.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          <CardTitle>Key Usage Statistics</CardTitle>
        </div>
        <CardDescription>
          Total requests: {stats.totalRequests.toLocaleString()}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {stats.providerStats.map((provider) => (
          <div key={provider.providerId} className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">{provider.providerName}</h4>
              <span className="text-xs text-muted-foreground">
                {provider.totalRequests.toLocaleString()} requests • {provider.validKeys}/{provider.keyCount} keys active
              </span>
            </div>
            <div className="space-y-2">
              {provider.keys.map((key) => (
                <div key={key.id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className={key.isValid && key.isEnabled ? '' : 'text-muted-foreground'}>
                      {key.label}
                      {(!key.isValid || !key.isEnabled) && (
                        <span className="ml-1 text-destructive">
                          ({!key.isValid ? 'invalid' : 'disabled'})
                        </span>
                      )}
                    </span>
                    <span className="tabular-nums">
                      {key.requestCount.toLocaleString()}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full transition-all ${
                        key.isValid && key.isEnabled
                          ? 'bg-primary'
                          : 'bg-muted-foreground/30'
                      }`}
                      style={{ width: `${key.percentage}%` }}
                    />
                  </div>
                  {key.lastUsedAt && (
                    <p className="text-xs text-muted-foreground">
                      Last used: {new Date(key.lastUsedAt).toLocaleString()}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
