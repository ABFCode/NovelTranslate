import { Book, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface EmptyStateProps {
  onAdd: () => void
}

export function EmptyState({ onAdd }: EmptyStateProps): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="rounded-full bg-muted p-4">
        <Book className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="mt-4 text-lg font-medium">No glossary terms</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Add terms to ensure consistent translations
      </p>
      <Button onClick={onAdd} className="mt-4">
        <Plus className="mr-2 h-4 w-4" />
        Add First Term
      </Button>
    </div>
  )
}
