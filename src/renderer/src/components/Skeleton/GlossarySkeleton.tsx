import { cn } from '@/lib/utils'

interface GlossarySkeletonProps {
  count?: number
  className?: string
}

export function GlossarySkeleton({ count = 8, className }: GlossarySkeletonProps): JSX.Element {
  return (
    <div className={cn('space-y-4', className)}>
      {/* Search and filters */}
      <div className="flex gap-4">
        <div className="h-10 flex-1 animate-pulse rounded-md border bg-muted" />
        <div className="h-10 w-32 animate-pulse rounded-md border bg-muted" />
        <div className="h-10 w-24 animate-pulse rounded-md bg-muted" />
      </div>

      {/* Table header */}
      <div className="rounded-lg border">
        <div className="flex border-b bg-muted/50 p-3">
          <div className="h-4 w-28 animate-pulse rounded bg-muted" />
          <div className="ml-8 h-4 w-28 animate-pulse rounded bg-muted" />
          <div className="ml-8 h-4 w-20 animate-pulse rounded bg-muted" />
          <div className="ml-auto h-4 w-16 animate-pulse rounded bg-muted" />
        </div>

        {/* Rows */}
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="flex items-center border-b p-3 last:border-b-0"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
            <div className="ml-8 h-4 w-28 animate-pulse rounded bg-muted" />
            <div className="ml-8">
              <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
            </div>
            <div className="ml-auto flex gap-2">
              <div className="h-7 w-7 animate-pulse rounded bg-muted" />
              <div className="h-7 w-7 animate-pulse rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
