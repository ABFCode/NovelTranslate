import { RouterProvider } from '@tanstack/react-router'
import { router } from '@/app/router'
import { UIModeProvider } from '@/contexts/UIModeContext'
import { ThemeProvider } from '@/contexts/ThemeContext'

function App(): React.JSX.Element {
  return (
    <ThemeProvider defaultTheme="system">
      <UIModeProvider>
        <RouterProvider router={router} />
      </UIModeProvider>
    </ThemeProvider>
  )
}

export default App
