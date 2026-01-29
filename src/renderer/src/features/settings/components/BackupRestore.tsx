import { useState } from 'react'
import { Download, Upload, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface BackupRestoreProps {
  onSettingsImported?: () => void
}

export function BackupRestore({ onSettingsImported }: BackupRestoreProps) {
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const result = await window.api.settings.export()
      if (result.success) {
        toast.success(`Settings exported to ${result.filePath}`)
      } else if (result.error !== 'Export cancelled') {
        toast.error(`Export failed: ${result.error}`)
      }
    } catch (error) {
      toast.error('Export failed')
      console.error('Export failed:', error)
    } finally {
      setIsExporting(false)
    }
  }

  const handleImport = async () => {
    setIsImporting(true)
    try {
      const result = await window.api.settings.import()
      if (result.success && result.imported) {
        const messages: string[] = []
        if (result.imported.settings) {
          messages.push('settings')
        }
        if (result.imported.glossaryTerms > 0) {
          messages.push(`${result.imported.glossaryTerms} glossary terms`)
        }
        toast.success(`Imported: ${messages.join(', ')}`)
        onSettingsImported?.()
      } else if (result.error !== 'Import cancelled') {
        toast.error(`Import failed: ${result.error}`)
      }
    } catch (error) {
      toast.error('Import failed')
      console.error('Import failed:', error)
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Backup & Restore</CardTitle>
        <CardDescription>Export or import your settings and glossary data</CardDescription>
      </CardHeader>
      <CardContent className="flex gap-4">
        <Button
          variant="outline"
          onClick={handleExport}
          disabled={isExporting || isImporting}
          className="flex-1"
        >
          {isExporting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          Export Settings
        </Button>
        <Button
          variant="outline"
          onClick={handleImport}
          disabled={isExporting || isImporting}
          className="flex-1"
        >
          {isImporting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Upload className="mr-2 h-4 w-4" />
          )}
          Import Settings
        </Button>
      </CardContent>
    </Card>
  )
}
