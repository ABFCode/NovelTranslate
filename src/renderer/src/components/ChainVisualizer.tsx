import { motion } from 'motion/react'
import { cn } from '@/lib/utils'
import type { ChainExecutionStep, ConfigFallback, TranslationConfig } from '../../../shared/types'

interface ChainVisualizerProps {
  /** The primary config */
  primaryConfig: TranslationConfig
  /** Fallback chain (if showing configured chain) */
  fallbacks?: ConfigFallback[]
  /** Available configs for fallback lookup */
  configs?: TranslationConfig[]
  /** Execution path (if showing actual execution) */
  executionPath?: ChainExecutionStep[]
  /** Compact mode for inline display */
  compact?: boolean
  /** Additional className */
  className?: string
}

/**
 * Visual representation of a config chain or execution path
 */
export function ChainVisualizer({
  primaryConfig,
  fallbacks = [],
  configs = [],
  executionPath,
  compact = false,
  className
}: ChainVisualizerProps): JSX.Element {
  // If we have an execution path, show that instead
  if (executionPath && executionPath.length > 0) {
    return (
      <ExecutionPathVisualizer
        steps={executionPath}
        compact={compact}
        className={className}
      />
    )
  }

  // Otherwise show the configured chain
  const sortedFallbacks = [...fallbacks].sort((a, b) => a.priority - b.priority)

  if (compact) {
    return (
      <div className={cn('flex items-center gap-1 text-xs', className)}>
        <ConfigBadge config={primaryConfig} isPrimary />
        {sortedFallbacks.map((fb, i) => {
          const config = configs.find((c) => c.id === fb.fallbackConfigId)
          return (
            <span key={fb.id} className="flex items-center gap-1">
              <ArrowIcon className="h-3 w-3 text-muted-foreground" />
              {config ? (
                <ConfigBadge config={config} conditionType={fb.conditionType} />
              ) : (
                <span className="text-muted-foreground">?</span>
              )}
            </span>
          )
        })}
      </div>
    )
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center gap-2">
        <ConfigCard config={primaryConfig} isPrimary />
      </div>
      
      {sortedFallbacks.map((fb, i) => {
        const config = configs.find((c) => c.id === fb.fallbackConfigId)
        return (
          <motion.div
            key={fb.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className="flex items-center gap-2 pl-4"
          >
            <div className="flex items-center gap-2 text-muted-foreground">
              <ArrowIcon className="h-4 w-4" />
              <span className="text-xs">{getConditionLabel(fb.conditionType)}</span>
            </div>
            {config ? (
              <ConfigCard config={config} />
            ) : (
              <div className="rounded-md border border-dashed px-2 py-1 text-sm text-muted-foreground">
                Unknown config
              </div>
            )}
          </motion.div>
        )
      })}
      
      {sortedFallbacks.length === 0 && (
        <div className="pl-4 text-xs text-muted-foreground">
          No fallbacks configured
        </div>
      )}
    </div>
  )
}

interface ExecutionPathVisualizerProps {
  steps: ChainExecutionStep[]
  compact?: boolean
  className?: string
}

function ExecutionPathVisualizer({
  steps,
  compact,
  className
}: ExecutionPathVisualizerProps): JSX.Element {
  if (compact) {
    return (
      <div className={cn('flex items-center gap-1 text-xs', className)}>
        {steps.map((step, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <ArrowIcon className="h-3 w-3 text-muted-foreground" />}
            <span
              className={cn(
                'rounded px-1.5 py-0.5',
                step.success
                  ? 'bg-green-500/10 text-green-600'
                  : 'bg-destructive/10 text-destructive'
              )}
            >
              {step.configName}
            </span>
          </span>
        ))}
      </div>
    )
  }

  return (
    <div className={cn('space-y-2', className)}>
      {steps.map((step, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.1 }}
          className={cn(
            'flex items-center gap-3 rounded-md border p-2',
            step.success ? 'border-green-500/30 bg-green-500/5' : 'border-destructive/30 bg-destructive/5'
          )}
        >
          <div className="flex-shrink-0">
            {step.success ? (
              <SuccessIcon className="h-4 w-4 text-green-600" />
            ) : (
              <ErrorIcon className="h-4 w-4 text-destructive" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm">{step.configName}</div>
            <div className="text-xs text-muted-foreground">
              {step.providerId} / {step.modelId}
              {step.durationMs && ` • ${step.durationMs}ms`}
              {step.attempt > 1 && ` • Attempt ${step.attempt}`}
            </div>
          </div>
          {!step.success && step.errorType && (
            <span className="text-xs rounded-full bg-destructive/10 px-2 py-0.5 text-destructive">
              {step.errorType}
            </span>
          )}
        </motion.div>
      ))}
    </div>
  )
}

interface ConfigBadgeProps {
  config: TranslationConfig
  isPrimary?: boolean
  conditionType?: string
}

function ConfigBadge({ config, isPrimary, conditionType }: ConfigBadgeProps): JSX.Element {
  return (
    <span
      className={cn(
        'rounded px-1.5 py-0.5 text-xs font-medium',
        isPrimary ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
      )}
      title={conditionType ? `Triggers on: ${conditionType}` : undefined}
    >
      {config.name}
    </span>
  )
}

interface ConfigCardProps {
  config: TranslationConfig
  isPrimary?: boolean
}

function ConfigCard({ config, isPrimary }: ConfigCardProps): JSX.Element {
  return (
    <div
      className={cn(
        'rounded-md border px-3 py-2',
        isPrimary && 'ring-2 ring-primary'
      )}
    >
      <div className="flex items-center gap-2">
        <span className="font-medium">{config.name}</span>
        {isPrimary && (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
            Primary
          </span>
        )}
      </div>
      <div className="text-xs text-muted-foreground">
        {getProviderName(config.providerId)} / {config.modelId}
      </div>
    </div>
  )
}

// Helpers
function getConditionLabel(conditionType: string): string {
  const labels: Record<string, string> = {
    any: 'On any error',
    content_block: 'On content blocked',
    rate_limit: 'On rate limit',
    timeout: 'On timeout',
    auth_error: 'On auth error',
    quota_exceeded: 'On quota exceeded',
    context_length: 'On context too long',
    network_error: 'On network error'
  }
  return labels[conditionType] || conditionType
}

function getProviderName(providerId: string): string {
  const names: Record<string, string> = {
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    gemini: 'Google Gemini'
  }
  return names[providerId] || providerId
}

// Icons
function ArrowIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
    </svg>
  )
}

function SuccessIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  )
}

function ErrorIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}
