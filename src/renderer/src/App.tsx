import { RouterProvider } from '@tanstack/react-router'
import { router } from '@/app/router'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { UIModeProvider } from '@/contexts/UIModeContext'

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
