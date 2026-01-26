import { createRouter, createRootRoute, createRoute } from '@tanstack/react-router'
import { RootLayout } from './RootLayout'
import { HomePage } from '@/features/home/HomePage'
import { ProjectPage } from '@/features/project/ProjectPage'
import { SettingsPage } from '@/features/settings/SettingsPage'

// Root route with layout
const rootRoute = createRootRoute({
  component: RootLayout,
})

// Home route
const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomePage,
})

// Project route
const projectRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/project/$projectId',
  component: ProjectPage,
})

// Settings route
const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: SettingsPage,
})

// Create route tree
const routeTree = rootRoute.addChildren([homeRoute, projectRoute, settingsRoute])

// Create router instance
export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
})

// Type declaration for router
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
