import { cn } from '@/lib/utils'
import type { CostEstimate } from '../../../shared/types'

interface CostEstimateDisplayProps {
  /** The cost estimate to display */
  estimate: CostEstimate
  /** Show breakdown by config */
  showBreakdown?: boolean
  /** Compact mode for inline display */
  compact?: boolean
  /** Additional className */
  className?: string
}

/**
 * Display component for cost estimates
 */
export function CostEstimateDisplay({
  estimate,
  showBreakdown = false,
  compact = false,
  className,
}: CostEstimateDisplayProps): JSX.Element {
  if (compact) {
    return (
      <span className={cn('text-sm', className)}>
        <span className="font-medium">{formatCurrency(estimate.totalCostUsd)}</span>
        <span className="text-muted-foreground ml-1">
          ({formatTokens(estimate.inputTokens)} in / {formatTokens(estimate.outputTokens)} out)
        </span>
      </span>
    )
  }

  return (
    <div className={cn('rounded-lg border p-4 space-y-3', className)}>
      {/* Total */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Estimated Cost</span>
        <span className="text-lg font-semibold">{formatCurrency(estimate.totalCostUsd)}</span>
      </div>

      {/* Token breakdown */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <div className="text-muted-foreground">Input</div>
          <div className="font-medium">
            {formatTokens(estimate.inputTokens)} tokens
            <span className="text-muted-foreground ml-1">
              ({formatCurrency(estimate.inputCostUsd)})
            </span>
          </div>
        </div>
        <div>
          <div className="text-muted-foreground">Output</div>
          <div className="font-medium">
            {formatTokens(estimate.outputTokens)} tokens
            <span className="text-muted-foreground ml-1">
              ({formatCurrency(estimate.outputCostUsd)})
            </span>
          </div>
        </div>
      </div>

      {/* Warnings */}
      {estimate.warnings && estimate.warnings.length > 0 && (
        <div className="space-y-1">
          {estimate.warnings.map((warning, i) => (
            <div
              key={i}
              className="flex items-center gap-2 text-sm text-yellow-600 dark:text-yellow-500"
            >
              <WarningIcon className="h-4 w-4 flex-shrink-0" />
              <span>{warning}</span>
            </div>
          ))}
        </div>
      )}

      {/* Config breakdown */}
      {showBreakdown && estimate.configBreakdown && estimate.configBreakdown.length > 1 && (
        <div className="border-t pt-3 mt-3">
          <div className="text-sm text-muted-foreground mb-2">Cost by Config</div>
          <div className="space-y-2">
            {estimate.configBreakdown.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span>{item.configName}</span>
                  <span className="text-xs text-muted-foreground">
                    ({(item.probability * 100).toFixed(0)}% likely)
                  </span>
                </div>
                <span>{formatCurrency(item.estimatedCostUsd)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Inline cost badge for compact display
 */
export function CostBadge({
  costUsd,
  className,
}: {
  costUsd: number
  className?: string
}): JSX.Element {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        getCostColor(costUsd),
        className
      )}
    >
      <CoinIcon className="h-3 w-3" />
      {formatCurrency(costUsd)}
    </span>
  )
}

/**
 * Token count display
 */
export function TokenCount({
  inputTokens,
  outputTokens,
  className,
}: {
  inputTokens: number
  outputTokens: number
  className?: string
}): JSX.Element {
  return (
    <span className={cn('text-xs text-muted-foreground', className)}>
      {formatTokens(inputTokens)} / {formatTokens(outputTokens)} tokens
    </span>
  )
}

// ============================================================================
// Helpers
// ============================================================================

function formatCurrency(value: number): string {
  if (value < 0.01) {
    return `$${value.toFixed(4)}`
  }
  if (value < 1) {
    return `$${value.toFixed(3)}`
  }
  return `$${value.toFixed(2)}`
}

function formatTokens(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`
  }
  return count.toString()
}

function getCostColor(cost: number): string {
  if (cost < 0.01) {
    return 'bg-green-500/10 text-green-600'
  }
  if (cost < 0.1) {
    return 'bg-yellow-500/10 text-yellow-600'
  }
  return 'bg-red-500/10 text-red-600'
}

// Icons
function WarningIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    </svg>
  )
}

function CoinIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  )
}
