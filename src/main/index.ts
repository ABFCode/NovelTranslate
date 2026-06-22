import { app, shell, BrowserWindow, session } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { registerIpcHandlers } from './ipc'
import { initDatabase, closeDatabase } from './database'
import { startSidecar, stopSidecar } from './services/sidecar'
import { setMainWindow } from './window'
import { logger } from './services/logger'

// Disable GPU for WSL compatibility (check for WSL environment)
const isWSL = process.platform === 'linux' && process.env.WSL_DISTRO_NAME
if (isWSL) {
  app.disableHardwareAcceleration()
}

let mainWindow: BrowserWindow | null = null

/**
 * Apply a Content-Security-Policy to all renderer responses. The renderer never
 * talks to the network directly (all provider/API calls go through the main
 * process over IPC), so the policy can be tight. Dev needs the extra allowances
 * for Vite's HMR (inline/eval scripts + websocket); production is locked down.
 */
function setupContentSecurityPolicy(): void {
  const devCsp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self' ws: http://localhost:* http://127.0.0.1:*",
  ].join('; ')

  const prodCsp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
  ].join('; ')

  const csp = is.dev ? devCsp : prodCsp

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp],
      },
    })
  })
}

function createWindow(): void {
  // Create the browser window with security settings
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 15, y: 10 },
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      // Security: Enable context isolation
      contextIsolation: true,
      // Security: Disable node integration in renderer
      nodeIntegration: false,
      // Security: Sandbox can cause issues with preload in some setups
      sandbox: false,
    },
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
    setMainWindow(null)
  })

  // Make window available to other modules
  setMainWindow(mainWindow)

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Block in-page navigation away from the app's own content. Any attempt to
  // navigate elsewhere (e.g. an injected or mistyped link) is cancelled and
  // opened in the user's real browser instead.
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const rendererUrl = process.env['ELECTRON_RENDERER_URL']
    const isInternal =
      url.startsWith('file://') || (is.dev && rendererUrl ? url.startsWith(rendererUrl) : false)
    if (!isInternal) {
      event.preventDefault()
      shell.openExternal(url)
    }
  })

  // HMR for renderer based on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.whenReady().then(async () => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.noveltranslate')

  // Apply Content-Security-Policy to renderer responses
  setupContentSecurityPolicy()

  // Initialize database
  try {
    initDatabase()
    logger.info('[Main] Database initialized')
  } catch (error) {
    logger.error('[Main] Failed to initialize database:', error instanceof Error ? error : new Error(String(error)))
  }

  // Start Go sidecar (don't await - let it start in background)
  startSidecar().catch((error) => {
    logger.error('[Main] Failed to start sidecar:', error instanceof Error ? error : new Error(String(error)))
  })

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Register IPC handlers
  registerIpcHandlers()

  // Create the main window
  createWindow()

  app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

// Quit when all windows are closed, except on macOS.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Clean up on quit
app.on('will-quit', () => {
  stopSidecar()
  closeDatabase()
  logger.info('[Main] Application shutting down')
})

// Re-export getMainWindow for convenience
export { getMainWindow } from './window'
