export { };

declare global {
    interface Window {
        electronAPI: {
            getConfig: () => Promise<any>
            saveConfig: (config: any) => Promise<void>

            searchMessages: (query: string) => Promise<any[]>
            getRecentConversations: () => Promise<any[]>
            getMessages: (id: number) => Promise<any[]>
            saveMessage: (data: any) => Promise<void>
            createConversation: (data: any) => Promise<number>
            getInjectorPath: () => Promise<string>

            // New Storage APIs
            getConversation: (conversationId: string) => Promise<any>
            saveConversation: (conversation: any) => Promise<any>
            findConversationByUrl: (url: string) => Promise<any>
            deleteConversation: (conversationId: string) => Promise<any>
            getConversationsByPlatform: (platform: string) => Promise<any[]>
            advancedSearch: (query: any) => Promise<any[]>
            reindexMessages: () => Promise<{ success: boolean; count: number }>

            // Settings APIs
            getStorageStats: () => Promise<{ conversationCount: number; messageCount: number; sizeInBytes: number; sizeInMB: string }>
            exportConversations: () => Promise<any[]>
            clearAllData: () => Promise<{ success: boolean }>

            onConversationUpdate: (callback: () => void) => () => void

            // Window Controls
            minimizeWindow: () => void
            maximizeWindow: () => void
            closeWindow: () => void
        }
    }
}
