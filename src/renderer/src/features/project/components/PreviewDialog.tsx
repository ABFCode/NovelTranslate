import { useState } from 'react'
import { Eye, Loader2, CheckCircle2, XCircle } from 'lucide-react'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { PreviewResult } from '@shared/types'

interface PreviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sourceText: string | null
  configId: string | null
  sourceLanguage: string
  targetLanguage: string
  onTranslateChapter?: () => void
}

export function PreviewDialog({
  open,
  onOpenChange,
  sourceText,
  configId,
  sourceLanguage,
  targetLanguage,
  onTranslateChapter
}: PreviewDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<PreviewResult | null>(null)

  const handlePreview = async () => {
    if (!sourceText || !configId) return

    setIsLoading(true)
    setResult(null)

    try {
      const previewResult = await window.api.translation.preview(
        sourceText,
        configId,
        sourceLanguage,
        targetLanguage
      )
      setResult(previewResult)
    } catch (error) {
      toast.error('Preview failed')
      console.error('Preview failed:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setResult(null)
    }
    onOpenChange(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Translation Preview
          </DialogTitle>
          <DialogDescription>
            Preview how the translation will look before processing the full chapter.
            This translates the first ~1000 characters.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {!result && !isLoading && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Eye className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground mb-4">
                Click "Generate Preview" to see a sample translation.
              </p>
              <Button onClick={handlePreview} disabled={!sourceText || !configId}>
                Generate Preview
              </Button>
            </div>
          )}

          {isLoading && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">Generating preview...</p>
            </div>
          )}

          {result && (
            <div className="space-y-4">
              {/* Status banner */}
              <div
                className={`flex items-center gap-2 rounded-lg px-3 py-2 ${
                  result.success
                    ? 'bg-green-500/10 text-green-600'
                    : 'bg-destructive/10 text-destructive'
                }`}
              >
                {result.success ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                <span className="text-sm font-medium">
                  {result.success ? 'Preview successful' : 'Preview failed'}
                </span>
                {result.success && (
                  <span className="ml-auto text-xs">
                    Cost: ${result.costUsd.toFixed(4)} |
                    Tokens: {result.tokensUsed.input} in, {result.tokensUsed.output} out
                  </span>
                )}
              </div>

              {result.error && (
                <p className="text-sm text-destructive">{result.error}</p>
              )}

              {/* Side-by-side comparison */}
              <Tabs defaultValue="side-by-side" className="flex-1">
                <TabsList>
                  <TabsTrigger value="side-by-side">Side by Side</TabsTrigger>
                  <TabsTrigger value="original">Original</TabsTrigger>
                  <TabsTrigger value="translated">Translated</TabsTrigger>
                </TabsList>

                <TabsContent value="side-by-side" className="mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">Original ({sourceLanguage})</h4>
                      <ScrollArea className="h-[300px] rounded-md border p-3">
                        <p className="text-sm whitespace-pre-wrap">{result.originalText}</p>
                      </ScrollArea>
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">Translated ({targetLanguage})</h4>
                      <ScrollArea className="h-[300px] rounded-md border p-3">
                        <p className="text-sm whitespace-pre-wrap">
                          {result.translatedText || 'No translation available'}
                        </p>
                      </ScrollArea>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="original" className="mt-4">
                  <ScrollArea className="h-[350px] rounded-md border p-4">
                    <p className="whitespace-pre-wrap">{result.originalText}</p>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="translated" className="mt-4">
                  <ScrollArea className="h-[350px] rounded-md border p-4">
                    <p className="whitespace-pre-wrap">
                      {result.translatedText || 'No translation available'}
                    </p>
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Close
          </Button>
          {result && (
            <Button onClick={handlePreview} variant="outline" disabled={isLoading}>
              Regenerate
            </Button>
          )}
          {result?.success && onTranslateChapter && (
            <Button
              onClick={() => {
                handleOpenChange(false)
                onTranslateChapter()
              }}
            >
              Translate Full Chapter
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
