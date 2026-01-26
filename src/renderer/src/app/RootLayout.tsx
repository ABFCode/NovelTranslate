import { Outlet } from '@tanstack/react-router'
import { Toaster } from 'sonner'
import { Sidebar } from './Sidebar'
import { TitleBar } from './TitleBar'

export function RootLayout() {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      {/* Custom title bar for frameless window */}
      <TitleBar />

      {/* Main content area with sidebar */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar navigation */}
        <Sidebar />

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>

      {/* Toast notifications */}
      <Toaster
        position="bottom-right"
        toastOptions={{
          className: 'bg-card text-card-foreground border shadow-lg',
        }}
      />
    </div>
  )
}
