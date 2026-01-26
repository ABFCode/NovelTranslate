import { useEffect } from 'react'
import { useParams } from '@tanstack/react-router'
import { BookOpen, Play, Pause, FileText, CheckCircle, AlertCircle, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useProjectStore } from './project.store'
import type { Chapter, ChapterStatus } from '@shared/types'

export function ProjectPage() {
  const { projectId } = useParams({ from: '/project/$projectId' })
  const { currentProject, chapters, isLoading, loadProject } = useProjectStore()

  useEffect(() => {
    if (projectId) {
      loadProject(projectId)
    }
  }, [projectId])

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Loading project...</p>
      </div>
    )
  }

  if (!currentProject) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Project not found</p>
      </div>
    )
  }

  const stats = getChapterStats(chapters)
  const progressPercent =
    chapters.length > 0 ? (stats.translated / chapters.length) * 100 : 0

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <BookOpen className="h-6 w-6" />
              {currentProject.name}
            </h1>
            <p className="mt-1 text-muted-foreground">
              {currentProject.metadata.author || 'Unknown Author'}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline">
              <Pause className="mr-2 h-4 w-4" />
              Pause
            </Button>
            <Button>
              <Play className="mr-2 h-4 w-4" />
              Translate
            </Button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4">
          <div className="mb-2 flex justify-between text-sm">
            <span className="text-muted-foreground">Translation Progress</span>
            <span className="font-medium">
              {stats.translated} / {chapters.length} chapters
            </span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Chapter list */}
        <div className="w-80 border-r">
          <Tabs defaultValue="all" className="flex h-full flex-col">
            <div className="border-b px-4 py-2">
              <TabsList className="w-full">
                <TabsTrigger value="all" className="flex-1">
                  All ({chapters.length})
                </TabsTrigger>
                <TabsTrigger value="pending" className="flex-1">
                  Pending ({stats.pending})
                </TabsTrigger>
                <TabsTrigger value="error" className="flex-1">
                  Errors ({stats.error})
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="all" className="m-0 flex-1 overflow-hidden">
              <ChapterList chapters={chapters} />
            </TabsContent>
            <TabsContent value="pending" className="m-0 flex-1 overflow-hidden">
              <ChapterList chapters={chapters.filter((c) => c.status === 'pending')} />
            </TabsContent>
            <TabsContent value="error" className="m-0 flex-1 overflow-hidden">
              <ChapterList chapters={chapters.filter((c) => c.status === 'error')} />
            </TabsContent>
          </Tabs>
        </div>

        {/* Chapter content viewer */}
        <div className="flex-1 overflow-auto p-6">
          <Card>
            <CardHeader>
              <CardTitle>Chapter Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Select a chapter to view its content
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function ChapterList({ chapters }: { chapters: Chapter[] }) {
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
          <ChapterItem key={chapter.id} chapter={chapter} />
        ))}
      </div>
    </ScrollArea>
  )
}

function ChapterItem({ chapter }: { chapter: Chapter }) {
  return (
    <div className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 hover:bg-accent">
      <StatusIcon status={chapter.status} />
      <div className="flex-1 truncate">
        <p className="truncate text-sm">{chapter.title || `Chapter ${chapter.spineIndex + 1}`}</p>
      </div>
    </div>
  )
}

function StatusIcon({ status }: { status: ChapterStatus }) {
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

function getChapterStats(chapters: Chapter[]) {
  return {
    pending: chapters.filter((c) => c.status === 'pending').length,
    translating: chapters.filter((c) => c.status === 'translating').length,
    translated: chapters.filter((c) => c.status === 'translated').length,
    error: chapters.filter((c) => c.status === 'error').length,
    skipped: chapters.filter((c) => c.status === 'skipped').length,
  }
}
