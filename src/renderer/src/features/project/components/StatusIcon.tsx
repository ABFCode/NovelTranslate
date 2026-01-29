import { CheckCircle, AlertCircle, Clock, FileText } from 'lucide-react'
import type { ChapterStatus } from '@shared/types'

interface StatusIconProps {
  status: ChapterStatus
}

export function StatusIcon({ status }: StatusIconProps): JSX.Element {
  switch (status) {
    case 'translated':
      return <CheckCircle className="h-4 w-4 shrink-0 text-green-600" />
    case 'error':
      return <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
    case 'translating':
      return <Clock className="h-4 w-4 shrink-0 animate-pulse text-yellow-600" />
    default:
      return <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
  }
}
