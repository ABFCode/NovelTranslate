import { cn } from '@/lib/utils'

interface ConfigsSkeletonProps {
  mode?: 'grid' | 'table'
  count?: number
  className?: string
}

export function ConfigsSkeleton({
  mode = 'grid',
  count = 6,
  className,
}: ConfigsSkeletonProps): JSX.Element {
  if (mode === 'table') {
    return (
      <div className={cn('rounded-lg border', className)}>
        {/* Header */}
        <div className="flex border-b bg-muted/50 p-4">
          <div className="h-4 w-32 animate-pulse rounded bg-muted" />
          <div className="ml-auto flex gap-4">
            <div className="h-4 w-20 animate-pulse rounded bg-muted" />
            <div className="h-4 w-20 animate-pulse rounded bg-muted" />
          </div>
        </div>
        {/* Rows */}
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="flex items-center border-b p-4 last:border-b-0">
            <div className="h-4 w-40 animate-pulse rounded bg-muted" />
            <div className="ml-8 h-4 w-24 animate-pulse rounded bg-muted" />
            <div className="ml-auto flex gap-2">
              <div className="h-8 w-8 animate-pulse rounded bg-muted" />
              <div className="h-8 w-8 animate-pulse rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className={cn('grid gap-4 sm:grid-cols-2 lg:grid-cols-3', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-lg border p-4" style={{ animationDelay: `${i * 100}ms` }}>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="h-5 w-32 animate-pulse rounded bg-muted" />
              <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
            </div>
            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
            <div className="flex justify-between pt-2">
              <div className="h-3 w-16 animate-pulse rounded bg-muted" />
              <div className="flex gap-1">
                <div className="h-6 w-6 animate-pulse rounded bg-muted" />
                <div className="h-6 w-6 animate-pulse rounded bg-muted" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
