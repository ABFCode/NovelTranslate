import { Link, useRouterState } from '@tanstack/react-router'
import { Home, Settings, BookOpen, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useProjectStore } from '@/features/project/project.store'

export function Sidebar() {
  const routerState = useRouterState()
  const currentPath = routerState.location.pathname
  const { recentProjects } = useProjectStore()

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
          <Button variant="ghost" size="icon" className="h-6 w-6">
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
                <NavItem
                  key={project.id}
                  to={`/project/${project.id}`}
                  icon={<BookOpen className="h-4 w-4" />}
                  label={project.name}
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
