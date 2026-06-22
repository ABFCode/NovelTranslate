import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Chapter, ChapterContent, TranslationOverride } from '@shared/types'
import type { OverrideDraft } from './OverrideDialog'

interface ChapterContentViewerProps {
  activeChapter: Chapter | undefined
  chapterContent: ChapterContent | null
  isLoadingContent: boolean
  overrides: TranslationOverride[]
  onOverrideDraft: (draft: OverrideDraft) => void
}

export function ChapterContentViewer({
  activeChapter,
  chapterContent,
  isLoadingContent,
  overrides,
  onOverrideDraft
}: ChapterContentViewerProps): JSX.Element {
  const overridesBySegment = useMemo(() => {
    return new Map(overrides.map((override) => [override.sourceSegment, override]))
  }, [overrides])

  const segments = useMemo(() => {
    if (!chapterContent?.sourceText) return []
    return splitSegments(chapterContent.sourceText)
  }, [chapterContent])

  const translatedSegments = useMemo(() => {
    if (!chapterContent?.translatedText) return []
    return splitSegments(chapterContent.translatedText)
  }, [chapterContent])

  const chapterPairs = useMemo(() => {
    return segments.map((segment, index) => ({
      source: segment,
      translation: translatedSegments[index] || ''
    }))
  }, [segments, translatedSegments])

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Chapter Preview</CardTitle>
          {activeChapter && (
            <span className="text-xs text-muted-foreground">
              {activeChapter.title || `Chapter ${activeChapter.spineIndex + 1}`}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!activeChapter ? (
          <p className="text-muted-foreground">Select a chapter to view its content</p>
        ) : isLoadingContent && chapterPairs.length === 0 ? (
          // Only show the spinner when there's nothing to display yet (first load).
          // When switching chapters we keep the previous content visible until the
          // new content arrives, which avoids a flash/collapse on every click.
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            Loading chapter content...
          </div>
        ) : chapterPairs.length === 0 ? (
          <p className="text-muted-foreground">No chapter content available</p>
        ) : (
          <div className="space-y-4">
            {chapterPairs.map((pair, index) => {
              const override = overridesBySegment.get(pair.source)
              const displayed = override ? override.overrideTranslation : pair.translation
              return (
                <div key={index} className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Segment {index + 1}</span>
                    <div className="flex items-center gap-2">
                      {override && (
                        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-600">
                          Override ({override.scope})
                        </span>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          onOverrideDraft({
                            id: override?.id,
                            sourceSegment: pair.source,
                            originalTranslation: pair.translation || '',
                            overrideTranslation:
                              override?.overrideTranslation || pair.translation || '',
                            scope: override?.scope || 'chapter',
                            reason: override?.reason || ''
                          })
                        }
                      >
                        {override ? 'Edit Override' : 'Add Override'}
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground">Source</span>
                      <p className="whitespace-pre-wrap text-sm">{pair.source}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground">Translation</span>
                      <p className="whitespace-pre-wrap text-sm">
                        {displayed || (
                          <span className="text-muted-foreground">No translation yet</span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function splitSegments(text: string): string[] {
  const normalized = text.replace(/\r\n/g, '\n').trim()
  if (!normalized) return []
  const blocks = normalized.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean)
  if (blocks.length > 1) return blocks
  return normalized.split('\n').map((line) => line.trim()).filter(Boolean)
}
