import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import {
  BookOpen,
  BookText,
  Database,
  Feather,
  FlaskConical,
  Home,
  Moon,
  Plus,
  Settings,
  Sliders,
  Sun,
} from 'lucide-react'
import { motion } from 'motion/react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useTheme } from '@/contexts/ThemeContext'
import { useUIMode } from '@/contexts/UIModeContext'
import { useProjectStore } from '@/features/project/project.store'
import { cn } from '@/lib/utils'

export function Sidebar() {
  const navigate = useNavigate()
  const routerState = useRouterState()
  const currentPath = routerState.location.pathname
  const { recentProjects, loadProjects } = useProjectStore()
  const { isAdvanced } = useUIMode()
  const { resolvedTheme, toggleTheme } = useTheme()

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
    <div className="flex h-full w-60 shrink-0 flex-col border-r bg-sidebar">
      {/* Logo */}
      <div className="px-4 py-4">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-accent">
            <Feather className="h-4 w-4 text-sidebar-primary" />
          </div>
          <span className="text-sm font-semibold text-sidebar-foreground">NovelTranslate</span>
        </Link>
      </div>

      {/* Main navigation */}
      <nav className="flex flex-col gap-0.5 px-3">
        <NavItem
          to="/"
          icon={<Home className="h-4 w-4" />}
          label="Home"
          active={currentPath === '/'}
        />
        <NavItem
          to="/configs"
          icon={<Sliders className="h-4 w-4" />}
          label="Configurations"
          active={currentPath.startsWith('/configs')}
        />
        <NavItem
          to="/testing"
          icon={<FlaskConical className="h-4 w-4" />}
          label="Testing Lab"
          active={currentPath === '/testing'}
        />
        <NavItem
          to="/glossary"
          icon={<BookText className="h-4 w-4" />}
          label="Glossary"
          active={currentPath === '/glossary'}
        />
        <NavItem
          to="/memory"
          icon={<Database className="h-4 w-4" />}
          label="Memory"
          active={currentPath === '/memory'}
        />
        <NavItem
          to="/settings"
          icon={<Settings className="h-4 w-4" />}
          label="Settings"
          active={currentPath === '/settings'}
        />
      </nav>

      {/* Recent projects section */}
      <div className="mt-6 flex-1 overflow-hidden px-3">
        <div className="mb-2 flex items-center justify-between px-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-sidebar-muted">
            Library
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-primary"
            onClick={handleImportEpub}
            title="Import EPUB"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>

        <ScrollArea className="h-[calc(100%-2rem)]">
          {recentProjects.length === 0 ? (
            <div className="px-2 py-8 text-center">
              <BookOpen className="mx-auto h-8 w-8 text-sidebar-muted opacity-40" />
              <p className="mt-3 text-xs text-sidebar-muted">No books yet</p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 h-7 text-xs text-sidebar-primary hover:bg-sidebar-accent"
                onClick={handleImportEpub}
              >
                <Plus className="mr-1.5 h-3 w-3" />
                Import EPUB
              </Button>
            </div>
          ) : (
            <div className="stagger-children flex flex-col gap-0.5">
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

      {/* Footer */}
      <div className="mt-auto border-t border-sidebar-border">
        {/* Mode and theme */}
        <div className="flex items-center justify-between px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-sidebar-muted">Mode</span>
            <span
              className={cn(
                'rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
                isAdvanced()
                  ? 'bg-sidebar-primary/20 text-sidebar-primary'
                  : 'bg-sidebar-accent text-sidebar-muted'
              )}
            >
              {isAdvanced() ? 'Advanced' : 'Simple'}
            </span>
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            className="flex h-7 w-7 items-center justify-center rounded-md text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
            title={resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {resolvedTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>

        {/* Version */}
        <div className="border-t border-sidebar-border px-4 py-2">
          <p className="text-center text-[10px] text-sidebar-muted">Version 1.0.0</p>
        </div>
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
    <Link to={to} className={cn('sidebar-nav-item flex items-center gap-3', active && 'active')}>
      <span
        className={cn('transition-colors', active ? 'text-sidebar-primary' : 'text-sidebar-muted')}
      >
        {icon}
      </span>
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
    <motion.div whileHover={{ x: 2 }} transition={{ duration: 0.15 }}>
      <Link
        to="/project/$projectId"
        params={{ projectId }}
        className={cn(
          'flex items-center gap-2.5 rounded-md px-2 py-2 text-sm transition-colors',
          active
            ? 'bg-sidebar-accent text-sidebar-primary'
            : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
        )}
      >
        <BookOpen
          className={cn('h-4 w-4 shrink-0', active ? 'text-sidebar-primary' : 'text-sidebar-muted')}
        />
        <span className="truncate font-medium">{name}</span>
      </Link>
    </motion.div>
  )
}
