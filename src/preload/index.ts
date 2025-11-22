import { contextBridge, ipcRenderer } from 'electron'

// Expose Electron APIs to Renderer process via contextBridge
contextBridge.exposeInMainWorld('electronAPI', {
    // Config
    getConfig: () => ipcRenderer.invoke('get-config'),
    saveConfig: (config: any) => ipcRenderer.invoke('save-config', config),

    // Database - Legacy APIs
    searchMessages: (query: string) => ipcRenderer.invoke('search-messages', query),
    getRecentConversations: () => ipcRenderer.invoke('get-recent-conversations'),
    getMessages: (id: number) => ipcRenderer.invoke('get-messages', id),
    saveMessage: (data: any) => ipcRenderer.invoke('save-message', data),
    createConversation: (data: any) => ipcRenderer.invoke('create-conversation', data),
    getInjectorPath: () => ipcRenderer.invoke('get-injector-path'),

    // New Storage APIs for Chat Memo adapters
    getConversation: (conversationId: string) => ipcRenderer.invoke('storage:get-conversation', conversationId),
    saveConversation: (conversation: any) => ipcRenderer.invoke('storage:save-conversation', conversation),
    findConversationByUrl: (url: string) => ipcRenderer.invoke('storage:find-by-url', url),
    deleteConversation: (conversationId: string) => ipcRenderer.invoke('storage:delete-conversation', conversationId),
    getConversationsByPlatform: (platform: string) => ipcRenderer.invoke('storage:get-by-platform', platform),
    advancedSearch: (query: any) => ipcRenderer.invoke('storage:advanced-search', query),
    reindexMessages: () => ipcRenderer.invoke('storage:reindex-messages'),

    // Settings APIs
    getStorageStats: () => ipcRenderer.invoke('get-storage-stats'),
    exportConversations: () => ipcRenderer.invoke('export-conversations'),
    clearAllData: () => ipcRenderer.invoke('clear-all-data'),

    // Events
    onConversationUpdate: (callback: () => void) => {
        const listener = (_event: any) => callback()
        ipcRenderer.on('conversation-updated', listener)
        return () => ipcRenderer.removeListener('conversation-updated', listener)
    },

    // Window Controls
    minimizeWindow: () => ipcRenderer.send('window-minimize'),
    maximizeWindow: () => ipcRenderer.send('window-maximize'),
    closeWindow: () => ipcRenderer.send('window-close'),
})
