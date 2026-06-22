import { useNavigate } from '@tanstack/react-router'
import { ArrowRight, BookOpen, Clock, FolderOpen, Settings, Sparkles, Upload } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { useProjectStore } from '@/features/project/project.store'
import { cn } from '@/lib/utils'

export function HomePage() {
  const navigate = useNavigate()
  const { recentProjects, loadProjects, isLoading } = useProjectStore()
  const [systemStatus, setSystemStatus] = useState({
    ipc: false,
    sidecar: false,
  })

  useEffect(() => {
    loadProjects()
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
    if (!window.api) {
      toast.error('API not available')
      return
    }

    try {
      const project = await window.api.project.importEpub()
      if (!project) return

      toast.success(`Imported: ${project.name}`)
      loadProjects()
      navigate({ to: '/project/$projectId', params: { projectId: project.id } })
    } catch (error) {
      console.error('Import failed:', error)
      toast.error(`Import failed: ${error}`)
    }
  }

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">Home</h1>
            <p className="page-subtitle">Import books and manage your translation projects</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleImportEpub} className="gap-2">
              <Upload className="h-4 w-4" />
              Import EPUB
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate({ to: '/configs' })}
              className="gap-2"
            >
              <Sparkles className="h-4 w-4" />
              Configs
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8">
        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="grid gap-4 md:grid-cols-3 mb-10"
        >
          <QuickActionCard
            icon={<Upload className="h-5 w-5" />}
            title="Import EPUB"
            description="Start a new project from an EPUB file"
            onClick={handleImportEpub}
            accent
          />
          <QuickActionCard
            icon={<Settings className="h-5 w-5" />}
            title="Settings"
            description="API keys and app preferences"
            onClick={() => navigate({ to: '/settings' })}
          />
          <QuickActionCard
            icon={<FolderOpen className="h-5 w-5" />}
            title="Configs"
            description="Manage translation configurations"
            onClick={() => navigate({ to: '/configs' })}
          />
        </motion.div>

        {/* Recent Projects */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">Recent Projects</h2>
            </div>
            {recentProjects.length > 0 && (
              <Button variant="ghost" size="sm" className="text-muted-foreground gap-1">
                View all
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>

          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="skeleton h-32 rounded-lg" />
              ))}
            </div>
          ) : recentProjects.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <BookOpen className="h-10 w-10 text-muted-foreground" />
                <h3 className="mt-4 font-semibold">No projects yet</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Import an EPUB file to get started
                </p>
                <Button className="mt-4 gap-2" onClick={handleImportEpub}>
                  <Upload className="h-4 w-4" />
                  Import EPUB
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="stagger-children grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {recentProjects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onClick={() =>
                    navigate({ to: '/project/$projectId', params: { projectId: project.id } })
                  }
                />
              ))}
            </div>
          )}
        </motion.div>

        {/* System Status */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-10"
        >
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                System Status
              </CardTitle>
            </CardHeader>
            <CardContent className="flex gap-6">
              <StatusIndicator
                label="IPC Bridge"
                status={systemStatus.ipc ? 'connected' : 'checking'}
              />
              <StatusIndicator
                label="Parser Engine"
                status={systemStatus.sidecar ? 'connected' : 'offline'}
              />
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}

interface QuickActionCardProps {
  icon: React.ReactNode
  title: string
  description: string
  onClick: () => void
  accent?: boolean
}

function QuickActionCard({ icon, title, description, onClick, accent }: QuickActionCardProps) {
  return (
    <Card
      className={cn(
        'group cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5',
        accent && 'border-primary/20 bg-primary/[0.02]'
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-3 text-base">
          <span
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-lg transition-colors',
              accent
                ? 'bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground'
                : 'bg-muted text-muted-foreground group-hover:bg-secondary'
            )}
          >
            {icon}
          </span>
          <span className="font-medium">{title}</span>
        </CardTitle>
        <CardDescription className="pl-12">{description}</CardDescription>
      </CardHeader>
    </Card>
  )
}

interface ProjectCardProps {
  project: {
    id: string
    name: string
    metadata: {
      author?: string
      totalChapters: number
      translatedChapters: number
    }
  }
  onClick: () => void
}

function ProjectCard({ project, onClick }: ProjectCardProps) {
  const progress =
    project.metadata.totalChapters > 0
      ? (project.metadata.translatedChapters / project.metadata.totalChapters) * 100
      : 0

  return (
    <Card
      className="group cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5"
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-sm font-medium line-clamp-1">{project.name}</CardTitle>
              <CardDescription className="text-xs">
                {project.metadata.author || 'Unknown Author'}
              </CardDescription>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-all group-hover:opacity-100 group-hover:translate-x-1" />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">
              {project.metadata.translatedChapters} / {project.metadata.totalChapters}
            </span>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>
      </CardContent>
    </Card>
  )
}

function StatusIndicator({ label, status }: { label: string; status: string }) {
  const isConnected = status === 'connected'
  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          'h-2 w-2 rounded-full',
          isConnected ? 'bg-success' : 'bg-muted-foreground animate-pulse'
        )}
      />
      <span className="text-sm text-muted-foreground">{label}</span>
      <span
        className={cn(
          'text-xs font-medium',
          isConnected ? 'text-success' : 'text-muted-foreground'
        )}
      >
        {status}
      </span>
    </div>
  )
}
