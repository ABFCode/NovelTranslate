import { cn } from '@/lib/utils'

interface TestingSkeletonProps {
  className?: string
}

export function TestingSkeleton({ className }: TestingSkeletonProps): JSX.Element {
  return (
    <div className={cn('flex h-full', className)}>
      {/* Left panel */}
      <div className="w-1/2 border-r p-4 space-y-4">
        {/* Tabs skeleton */}
        <div className="flex gap-2 rounded-lg bg-muted p-1">
          <div className="h-8 flex-1 animate-pulse rounded-md bg-background" />
          <div className="h-8 flex-1 animate-pulse rounded-md bg-muted-foreground/20" />
        </div>

        {/* Text area skeleton */}
        <div className="h-40 animate-pulse rounded-md border bg-muted" />

        {/* Language selectors */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="h-4 w-16 animate-pulse rounded bg-muted" />
            <div className="h-10 animate-pulse rounded-md border bg-muted" />
          </div>
          <div className="space-y-2">
            <div className="h-4 w-16 animate-pulse rounded bg-muted" />
            <div className="h-10 animate-pulse rounded-md border bg-muted" />
          </div>
        </div>

        {/* Config selection */}
        <div className="space-y-2">
          <div className="h-4 w-24 animate-pulse rounded bg-muted" />
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-lg border p-3"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <div className="h-5 w-5 animate-pulse rounded border bg-muted" />
                <div className="flex-1">
                  <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                  <div className="mt-1 h-3 w-24 animate-pulse rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="w-1/2 p-4 space-y-4">
        <div className="h-5 w-20 animate-pulse rounded bg-muted" />

        {/* Empty results placeholder */}
        <div className="flex h-64 flex-col items-center justify-center">
          <div className="h-16 w-16 animate-pulse rounded-full bg-muted" />
          <div className="mt-4 h-5 w-32 animate-pulse rounded bg-muted" />
          <div className="mt-2 h-4 w-48 animate-pulse rounded bg-muted" />
        </div>
      </div>
    </div>
  )
}
