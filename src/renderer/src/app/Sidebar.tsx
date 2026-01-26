import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { Home, Settings, BookOpen, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useProjectStore } from '@/features/project/project.store'

export function Sidebar() {
  const navigate = useNavigate()
  const routerState = useRouterState()
  const currentPath = routerState.location.pathname
  const { recentProjects, loadProjects } = useProjectStore()

  const handleImportEpub = async () => {
    if (!window.api) {
      toast.error('API not available')
      return
    }

    try {
      const project = await window.api.project.importEpub()
      if (!project) return // User cancelled

      toast.success(`Imported: ${project.name}`)
      loadProjects()
      navigate({ to: '/project/$projectId', params: { projectId: project.id } })
    } catch (error) {
      toast.error(`Import failed: ${error}`)
    }
  }

  return (
    <div className="flex h-full w-56 shrink-0 flex-col border-r bg-sidebar">
      {/* Main navigation */}
      <div className="flex flex-col gap-1 p-2">
        <NavItem
          to="/"
          icon={<Home className="h-4 w-4" />}
          label="Home"
          active={currentPath === '/'}
        />
        <NavItem
          to="/settings"
          icon={<Settings className="h-4 w-4" />}
          label="Settings"
          active={currentPath === '/settings'}
        />
      </div>

      <Separator />

      {/* Recent projects */}
      <div className="flex flex-col gap-1 p-2">
        <div className="flex items-center justify-between px-2 py-1">
          <span className="text-xs font-medium text-muted-foreground">Recent Projects</span>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-6 w-6"
            onClick={handleImportEpub}
            title="Import EPUB"
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>

        <ScrollArea className="h-48">
          {recentProjects.length === 0 ? (
            <p className="px-2 py-4 text-center text-xs text-muted-foreground">
              No recent projects
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              {recentProjects.map((project) => (
                <ProjectNavItem
                  key={project.id}
                  projectId={project.id}
                  name={project.name}
                  active={currentPath === `/project/${project.id}`}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Footer */}
      <div className="border-t p-2">
        <p className="text-center text-xs text-muted-foreground">v1.0.0</p>
      </div>
    </div>
  )
}

interface NavItemProps {
  to: string
  icon: React.ReactNode
  label: string
  active?: boolean
}

function NavItem({ to, icon, label, active }: NavItemProps) {
  return (
    <Link
      to={to}
      className={cn(
        'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
        active
          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
          : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
      )}
    >
      {icon}
      <span className="truncate">{label}</span>
    </Link>
  )
}

interface ProjectNavItemProps {
  projectId: string
  name: string
  active?: boolean
}

function ProjectNavItem({ projectId, name, active }: ProjectNavItemProps) {
  return (
    <Link
      to="/project/$projectId"
      params={{ projectId }}
      className={cn(
        'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
        active
          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
          : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
      )}
    >
      <BookOpen className="h-4 w-4" />
      <span className="truncate">{name}</span>
    </Link>
  )
}
