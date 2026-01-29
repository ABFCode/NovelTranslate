import { cn } from '@/lib/utils'
import type { TermType } from '../../../../../shared/types'

const TERM_TYPE_COLORS: Record<TermType, string> = {
  name: 'bg-blue-500/10 text-blue-600',
  place: 'bg-green-500/10 text-green-600',
  skill: 'bg-purple-500/10 text-purple-600',
  item: 'bg-orange-500/10 text-orange-600',
  honorific: 'bg-pink-500/10 text-pink-600',
  other: 'bg-gray-500/10 text-gray-600'
}

export function TermTypeBadge({ type }: { type: TermType }): JSX.Element {
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', TERM_TYPE_COLORS[type])}>
      {type}
    </span>
  )
}
