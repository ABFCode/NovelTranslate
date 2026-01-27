import { cn } from '@/lib/utils'
import { useUIMode, useFeatureMode, type Feature } from '@/contexts/UIModeContext'
import type { UIMode } from '../../../shared/types'

interface GlobalModeToggleProps {
  className?: string
}

/**
 * Toggle for global UI mode (Simple/Advanced)
 */
export function GlobalModeToggle({ className }: GlobalModeToggleProps): JSX.Element {
  const { globalMode, setGlobalMode } = useUIMode()

  return (
    <div className={cn('flex items-center gap-2 rounded-lg bg-muted p-1', className)}>
      <ModeButton
        label="Simple"
        active={globalMode === 'simple'}
        onClick={() => setGlobalMode('simple')}
      />
      <ModeButton
        label="Advanced"
        active={globalMode === 'advanced'}
        onClick={() => setGlobalMode('advanced')}
      />
    </div>
  )
}

interface FeatureModeToggleProps {
  feature: Feature
  className?: string
  showLabel?: boolean
}

/**
 * Toggle for feature-specific UI mode
 */
export function FeatureModeToggle({
  feature,
  className,
  showLabel = true
}: FeatureModeToggleProps): JSX.Element {
  const { mode, toggleMode } = useFeatureMode(feature)

  return (
    <button
      type="button"
      onClick={toggleMode}
      className={cn(
        'flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors',
        mode === 'advanced'
          ? 'bg-primary/10 text-primary hover:bg-primary/20'
          : 'bg-muted text-muted-foreground hover:bg-muted/80',
        className
      )}
    >
      {mode === 'advanced' ? (
        <>
          <AdvancedIcon />
          {showLabel && 'Advanced'}
        </>
      ) : (
        <>
          <SimpleIcon />
          {showLabel && 'Simple'}
        </>
      )}
    </button>
  )
}

interface AdvancedSectionProps {
  feature: Feature
  children: React.ReactNode
  title?: string
  className?: string
}

/**
 * Section that only shows in advanced mode
 */
export function AdvancedSection({
  feature,
  children,
  title,
  className
}: AdvancedSectionProps): JSX.Element | null {
  const { isAdvanced } = useFeatureMode(feature)

  if (!isAdvanced) return null

  return (
    <div className={cn('space-y-2', className)}>
      {title && (
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <AdvancedIcon className="h-3 w-3" />
          {title}
        </div>
      )}
      {children}
    </div>
  )
}

interface ShowAdvancedToggleProps {
  feature: Feature
  className?: string
}

/**
 * Expandable "Show advanced options" toggle
 */
export function ShowAdvancedToggle({ feature, className }: ShowAdvancedToggleProps): JSX.Element {
  const { isAdvanced, toggleMode } = useFeatureMode(feature)

  return (
    <button
      type="button"
      onClick={toggleMode}
      className={cn(
        'flex w-full items-center justify-center gap-1 rounded-md border border-dashed py-2 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary',
        className
      )}
    >
      {isAdvanced ? (
        <>
          <ChevronUpIcon />
          Hide advanced options
        </>
      ) : (
        <>
          <ChevronDownIcon />
          Show advanced options
        </>
      )}
    </button>
  )
}

// ============================================================================
// Helper Components
// ============================================================================

interface ModeButtonProps {
  label: string
  active: boolean
  onClick: () => void
}

function ModeButton({ label, active, onClick }: ModeButtonProps): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-md px-3 py-1 text-sm font-medium transition-colors',
        active ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
      )}
    >
      {label}
    </button>
  )
}

// Icons
function SimpleIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg className={cn('h-4 w-4', className)} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
    </svg>
  )
}

function AdvancedIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg className={cn('h-4 w-4', className)} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function ChevronDownIcon(): JSX.Element {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  )
}

function ChevronUpIcon(): JSX.Element {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
    </svg>
  )
}
