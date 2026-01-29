import { useState, useEffect } from 'react'
import { History, RotateCcw, Eye, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { TranslationVersion } from '@shared/types'

interface TranslationHistoryProps {
  chapterId: string | null
  chapterTitle?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onRestore?: () => void
}

export function TranslationHistory({
  chapterId,
  chapterTitle,
  open,
  onOpenChange,
  onRestore
}: TranslationHistoryProps) {
  const [versions, setVersions] = useState<TranslationVersion[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedVersion, setSelectedVersion] = useState<TranslationVersion | null>(null)
  const [isRestoring, setIsRestoring] = useState(false)

  useEffect(() => {
    if (open && chapterId) {
      loadVersions()
    } else {
      setVersions([])
      setSelectedVersion(null)
    }
  }, [open, chapterId])

  const loadVersions = async () => {
    if (!chapterId) return

    setIsLoading(true)
    try {
      const list = await window.api.chapter.listVersions(chapterId)
      setVersions(list)
    } catch (error) {
      toast.error('Failed to load version history')
      console.error('Failed to load versions:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleRestore = async (version: TranslationVersion) => {
    if (!confirm(`Restore to version ${version.versionNumber}? The current translation will be archived.`)) {
      return
    }

    setIsRestoring(true)
    try {
      const success = await window.api.chapter.restoreVersion(version.id)
      if (success) {
        toast.success(`Restored to version ${version.versionNumber}`)
        onRestore?.()
        onOpenChange(false)
      } else {
        toast.error('Failed to restore version')
      }
    } catch (error) {
      toast.error('Failed to restore version')
      console.error('Failed to restore version:', error)
    } finally {
      setIsRestoring(false)
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleString()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Translation History
          </DialogTitle>
          <DialogDescription>
            {chapterTitle || 'Chapter'} - {versions.length} version{versions.length !== 1 ? 's' : ''} available
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden grid grid-cols-[280px_1fr] gap-4">
          {/* Version list */}
          <div className="border rounded-md overflow-hidden">
            <div className="bg-muted px-3 py-2 text-sm font-medium">
              Versions
            </div>
            <ScrollArea className="h-[400px]">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : versions.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  No previous versions
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {versions.map((version) => (
                    <button
                      key={version.id}
                      className={`w-full text-left p-2 rounded-md text-sm transition-colors ${
                        selectedVersion?.id === version.id
                          ? 'bg-primary/10 border border-primary/20'
                          : 'hover:bg-muted'
                      }`}
                      onClick={() => setSelectedVersion(version)}
                    >
                      <div className="font-medium">Version {version.versionNumber}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(version.createdAt)}
                      </div>
                      {version.configName && (
                        <div className="text-xs text-muted-foreground truncate">
                          Config: {version.configName}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Version preview */}
          <div className="border rounded-md overflow-hidden flex flex-col">
            <div className="bg-muted px-3 py-2 text-sm font-medium flex items-center justify-between">
              <span>Preview</span>
              {selectedVersion && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7"
                  onClick={() => handleRestore(selectedVersion)}
                  disabled={isRestoring}
                >
                  {isRestoring ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  ) : (
                    <RotateCcw className="mr-1 h-3 w-3" />
                  )}
                  Restore
                </Button>
              )}
            </div>
            <ScrollArea className="flex-1 p-3">
              {selectedVersion ? (
                <div className="space-y-3">
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>Created: {formatDate(selectedVersion.createdAt)}</p>
                    {selectedVersion.configName && (
                      <p>Config: {selectedVersion.configName}</p>
                    )}
                    {selectedVersion.providerId && selectedVersion.modelId && (
                      <p>Model: {selectedVersion.providerId}/{selectedVersion.modelId}</p>
                    )}
                  </div>
                  <div className="border-t pt-3">
                    <p className="text-sm whitespace-pre-wrap">{selectedVersion.translatedText}</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <div className="text-center">
                    <Eye className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Select a version to preview</p>
                  </div>
                </div>
              )}
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
