import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router'
import { ConfigBuilder } from '@/features/configs/ConfigBuilder'
import { ConfigsPage } from '@/features/configs/ConfigsPage'
import { GlossaryPage } from '@/features/glossary/GlossaryPage'
import { HomePage } from '@/features/home/HomePage'
import { TranslationMemoryPage } from '@/features/memory/TranslationMemoryPage'
import { ProjectPage } from '@/features/project/ProjectPage'
import { SettingsPage } from '@/features/settings/SettingsPage'
import { TestingCenter } from '@/features/testing/TestingCenter'
import { RootLayout } from './RootLayout'

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

// Configs list route
const configsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/configs',
  component: ConfigsPage,
})

// Config builder route (new)
const configNewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/configs/new',
  component: ConfigBuilder,
})

// Config builder route (edit)
const configEditRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/configs/$id',
  component: ConfigBuilder,
})

// Testing Center route
const testingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/testing',
  component: TestingCenter,
})

// Glossary route
const glossaryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/glossary',
  component: GlossaryPage,
})

// Translation memory route
const memoryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/memory',
  component: TranslationMemoryPage,
})

// Create route tree
const routeTree = rootRoute.addChildren([
  homeRoute,
  projectRoute,
  settingsRoute,
  configsRoute,
  configNewRoute,
  configEditRoute,
  testingRoute,
  glossaryRoute,
  memoryRoute,
])

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
