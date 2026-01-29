import { RouterProvider } from '@tanstack/react-router'
import { router } from '@/app/router'
import { UIModeProvider } from '@/contexts/UIModeContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { ErrorBoundary } from '@/components/ErrorBoundary'

function App(): React.JSX.Element {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="system">
        <UIModeProvider>
          <RouterProvider router={router} />
        </UIModeProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}

export default App
