import { app, BrowserWindow, shell, ipcMain, session } from 'electron'
import path from 'node:path'
import { release } from 'node:os'
import { dbService } from './services/database'
import { configService } from './services/config'

// Disable GPU Acceleration to prevent crashes
app.disableHardwareAcceleration()

// Disable GPU Acceleration for Windows 7
if (release().startsWith('6.1')) app.disableHardwareAcceleration()

// Set application name for Windows 10+ notifications
if (process.platform === 'win32') app.setAppUserModelId(app.getName())

if (!app.requestSingleInstanceLock()) {
    app.quit()
    process.exit(0)
}

let win: BrowserWindow | null = null

const preload = path.join(__dirname, 'index.js')
const url = process.env.VITE_DEV_SERVER_URL
const indexHtml = path.join(__dirname, '../renderer/index.html')

async function createWindow() {
    win = new BrowserWindow({
        title: 'Electron AI Browser',
        icon: path.join(process.env.PUBLIC || '', 'favicon.ico'),
        width: 1200,
        height: 800,
        show: false, // Don't show until ready
        backgroundColor: '#0f172a', // Match loading screen background
        frame: false, // Frameless window
        titleBarStyle: 'hidden', // Hide default title bar
        webPreferences: {
            preload,
            nodeIntegration: false,
            contextIsolation: true,
            webviewTag: true,
        },
    })

    // Window Control IPC Handlers
    ipcMain.on('window-minimize', () => win?.minimize())
    ipcMain.on('window-maximize', () => {
        if (win?.isMaximized()) {
            win.unmaximize()
        } else {
            win?.maximize()
        }
    })
    ipcMain.on('window-close', () => win?.close())


    if (url) {
        win.loadURL(url)
    } else {
        win.loadFile(indexHtml)
    }
    // win.webContents.openDevTools()

    // Show window when content is ready
    win.once('ready-to-show', () => {
        win?.show()
    })

    win.webContents.on('did-finish-load', () => {
        win?.webContents.send('main-process-message', new Date().toLocaleString())
    })

    win.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('https:')) shell.openExternal(url)
        return { action: 'deny' }
    })
}

app.whenReady().then(async () => {
    createWindow()

    // Configure Session Proxy
    const config = configService.getConfig()
    const proxyUrl = config.proxy || ''

    const setProxyForSession = async (sess: Electron.Session) => {
        if (proxyUrl) {
            try {
                await sess.setProxy({
                    proxyRules: proxyUrl,
                    proxyBypassRules: 'localhost'
                })
                console.log(`Proxy set for session to ${proxyUrl}`)
            } catch (err) {
                console.error('Failed to set proxy:', err)
            }
        } else {
            // Explicitly set direct mode to avoid system proxy interference
            await sess.setProxy({ mode: 'direct' })
            console.log('No proxy configured for session (Direct mode).')
        }
    }

    // Set for default session
    await setProxyForSession(session.defaultSession)

    // Set for all future sessions (including webview partitions)
    app.on('session-created', (sess) => {
        setProxyForSession(sess)
    })
})

app.on('window-all-closed', () => {
    win = null
    if (process.platform !== 'darwin') app.quit()
})

app.on('second-instance', () => {
    if (win) {
        if (win.isMinimized()) win.restore()
        win.focus()
    }
})

app.on('activate', () => {
    const allWindows = BrowserWindow.getAllWindows()
    if (allWindows.length) {
        allWindows[0].focus()
    } else {
        createWindow()
    }
})

// --- IPC Handlers ---

// Config
ipcMain.handle('get-config', () => configService.getConfig())
ipcMain.handle('save-config', (_, newConfig) => configService.saveConfig(newConfig))

// Recent conversations
ipcMain.handle('get-recent-conversations', () => dbService.getRecentConversations())

// New Storage API for Chat Memo integration
ipcMain.handle('storage:get-conversation', (_, id) => dbService.getConversation(id))
ipcMain.handle('storage:save-conversation', async (_, conversation) => {
    console.log(`[Main] Received save request for conversation ${conversation.id}, messages: ${conversation.messages?.length}`);
    const result = await dbService.saveConversation(conversation)
    // Notify all windows about the update
    BrowserWindow.getAllWindows().forEach(win => {
        win.webContents.send('conversation-updated')
    })
    return result
})
ipcMain.handle('storage:find-by-url', (_, url) => dbService.findByUrl(url))
ipcMain.handle('storage:delete-conversation', async (_, id) => {
    const result = await dbService.deleteConversation(id)
    // Notify all windows about the update
    BrowserWindow.getAllWindows().forEach(win => {
        win.webContents.send('conversation-updated')
    })
    return result
})
ipcMain.handle('storage:get-by-platform', (_, platform) => dbService.getConversationsByPlatform(platform))
ipcMain.handle('storage:advanced-search', (_, query) => dbService.advancedSearch(query))
ipcMain.handle('storage:tokenize', async (_, text) => {
    const { tokenizerService } = await import('./services/tokenizer')
    return tokenizerService.tokenize(text)
})
ipcMain.handle('storage:reindex-messages', () => dbService.reindexMessages())

// Settings APIs
ipcMain.handle('get-storage-stats', () => dbService.getStorageStats())
ipcMain.handle('export-conversations', () => dbService.exportConversations())
ipcMain.handle('clear-all-data', async () => {
    const result = dbService.clearAllData()
    // Notify all windows about the update
    BrowserWindow.getAllWindows().forEach(win => {
        win.webContents.send('conversation-updated')
    })
    return result
})

// Legacy support (can be removed later)
ipcMain.handle('get-messages', (_, id) => {
    return []
})
ipcMain.handle('save-message', async () => {
    return { status: 'deprecated' }
})
ipcMain.handle('create-conversation', () => {
    return { status: 'deprecated' }
})

ipcMain.handle('get-injector-path', () => {
    return path.join(__dirname, 'injector.js')
})
