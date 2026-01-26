import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { BookOpen, FolderOpen, Settings, Upload, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useProjectStore } from '@/features/project/project.store'

export function HomePage() {
  const navigate = useNavigate()
  const { recentProjects, loadProjects, isLoading } = useProjectStore()
  const [systemStatus, setSystemStatus] = useState({
    ipc: false,
    sidecar: false,
  })

  useEffect(() => {
    // Load recent projects on mount
    loadProjects()

    // Check system status
    checkSystemStatus()
  }, [])

  const checkSystemStatus = async () => {
    try {
      const pingResult = await window.api.ping()
      setSystemStatus((s) => ({ ...s, ipc: pingResult === 'pong' }))

      const sidecarHealth = await window.api.sidecar.health()
      setSystemStatus((s) => ({ ...s, sidecar: sidecarHealth }))
    } catch (error) {
      console.error('System status check failed:', error)
    }
  }

  const handleImportEpub = async () => {
    // TODO: Open file dialog and import EPUB
    console.log('Import EPUB')
  }

  return (
    <div className="flex flex-col gap-8 p-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Welcome to NovelTranslate</h1>
        <p className="mt-2 text-muted-foreground">
          Fast, extensible novel translation powered by AI
        </p>
      </div>

      {/* Quick actions */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="cursor-pointer transition-shadow hover:shadow-lg" onClick={handleImportEpub}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Upload className="h-5 w-5 text-primary" />
              Import EPUB
            </CardTitle>
            <CardDescription>Start a new translation project from an EPUB file</CardDescription>
          </CardHeader>
        </Card>

        <Card
          className="cursor-pointer transition-shadow hover:shadow-lg"
          onClick={() => navigate({ to: '/settings' })}
        >
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Settings className="h-5 w-5 text-primary" />
              Settings
            </CardTitle>
            <CardDescription>Configure API keys and app preferences</CardDescription>
          </CardHeader>
        </Card>

        <Card className="cursor-pointer transition-shadow hover:shadow-lg">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <FolderOpen className="h-5 w-5 text-primary" />
              Open Project
            </CardTitle>
            <CardDescription>Continue working on an existing project</CardDescription>
          </CardHeader>
        </Card>
      </div>

      {/* Recent projects */}
      <div>
        <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold">
          <Clock className="h-5 w-5" />
          Recent Projects
        </h2>

        {isLoading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : recentProjects.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <BookOpen className="h-12 w-12 text-muted-foreground/50" />
              <p className="mt-4 text-center text-muted-foreground">
                No projects yet. Import an EPUB to get started!
              </p>
              <Button className="mt-4" onClick={handleImportEpub}>
                <Upload className="mr-2 h-4 w-4" />
                Import EPUB
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {recentProjects.map((project) => (
              <Card
                key={project.id}
                className="cursor-pointer transition-shadow hover:shadow-lg"
                onClick={() => navigate({ to: `/project/${project.id}` })}
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <BookOpen className="h-4 w-4" />
                    {project.name}
                  </CardTitle>
                  <CardDescription>
                    {project.metadata.translatedChapters} / {project.metadata.totalChapters} chapters
                    translated
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* System status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">System Status</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          <StatusRow
            label="IPC Communication"
            status={systemStatus.ipc ? 'connected' : 'checking'}
          />
          <StatusRow
            label="Go Sidecar"
            status={systemStatus.sidecar ? 'connected' : 'not running'}
          />
        </CardContent>
      </Card>
    </div>
  )
}

function StatusRow({ label, status }: { label: string; status: string }) {
  const isConnected = status === 'connected'
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span
        className={`text-sm font-medium ${isConnected ? 'text-green-600' : 'text-muted-foreground'}`}
      >
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    </div>
  )
}
