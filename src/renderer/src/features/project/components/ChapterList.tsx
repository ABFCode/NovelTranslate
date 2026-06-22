import type { Chapter } from '@shared/types'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Check } from 'lucide-react'
import { useRef } from 'react'
import { cn } from '@/lib/utils'
import { StatusIcon } from './StatusIcon'

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
  showSelection,
}: ChapterListProps): JSX.Element {
  const parentRef = useRef<HTMLDivElement>(null)

  // Virtualize so a project with thousands of chapters only renders the rows
  // actually on screen, instead of thousands of DOM nodes.
  const virtualizer = useVirtualizer({
    count: chapters.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 44,
    overscan: 12,
  })

  if (chapters.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">No chapters</p>
      </div>
    )
  }

  return (
    <div ref={parentRef} className="h-full overflow-auto px-2">
      <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
        {virtualizer.getVirtualItems().map((vi) => {
          const chapter = chapters[vi.index]
          return (
            <div
              key={chapter.id}
              data-index={vi.index}
              ref={virtualizer.measureElement}
              className="py-0.5"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${vi.start}px)`,
              }}
            >
              <ChapterItem
                chapter={chapter}
                isSelected={selectedChapters.has(chapter.id)}
                onToggleSelection={() => onToggleSelection(chapter.id)}
                onSelectChapter={() => onSelectChapter(chapter.id)}
                isActive={activeChapterId === chapter.id}
                showSelection={showSelection}
              />
            </div>
          )
        })}
      </div>
    </div>
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
  showSelection,
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
