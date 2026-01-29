import { Check } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { StatusIcon } from './StatusIcon'
import type { Chapter } from '@shared/types'

interface ChapterListProps {
  chapters: Chapter[]
  selectedChapters: Set<string>
  onToggleSelection: (id: string) => void
  activeChapterId: string | null
  onSelectChapter: (id: string) => void
  showSelection: boolean
}

export function ChapterList({
  chapters,
  selectedChapters,
  onToggleSelection,
  activeChapterId,
  onSelectChapter,
  showSelection
}: ChapterListProps): JSX.Element {
  if (chapters.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">No chapters</p>
      </div>
    )
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-2">
        {chapters.map((chapter) => (
          <ChapterItem
            key={chapter.id}
            chapter={chapter}
            isSelected={selectedChapters.has(chapter.id)}
            onToggleSelection={() => onToggleSelection(chapter.id)}
            onSelectChapter={() => onSelectChapter(chapter.id)}
            isActive={activeChapterId === chapter.id}
            showSelection={showSelection}
          />
        ))}
      </div>
    </ScrollArea>
  )
}

interface ChapterItemProps {
  chapter: Chapter
  isSelected: boolean
  onToggleSelection: () => void
  onSelectChapter: () => void
  isActive: boolean
  showSelection: boolean
}

function ChapterItem({
  chapter,
  isSelected,
  onToggleSelection,
  onSelectChapter,
  isActive,
  showSelection
}: ChapterItemProps): JSX.Element {
  return (
    <div
      className={cn(
        'flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 hover:bg-accent',
        isSelected && 'bg-primary/10',
        isActive && 'ring-1 ring-primary/30'
      )}
      onClick={onSelectChapter}
    >
      {showSelection && (
        <div
          className={cn(
            'flex h-4 w-4 items-center justify-center rounded border',
            isSelected ? 'border-primary bg-primary text-primary-foreground' : ''
          )}
          onClick={(event) => {
            event.stopPropagation()
            onToggleSelection()
          }}
        >
          {isSelected && <Check className="h-3 w-3" />}
        </div>
      )}
      <StatusIcon status={chapter.status} />
      <div className="flex-1 truncate">
        <p className="truncate text-sm">{chapter.title || `Chapter ${chapter.spineIndex + 1}`}</p>
      </div>
    </div>
  )
}
