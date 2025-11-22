import { useState, useEffect } from 'react'
import { Download, Trash2, Database, Settings as SettingsIcon, Globe, Moon, Sun } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'

export function Settings() {
    const [config, setConfig] = useState<any>(null)
    const [stats, setStats] = useState<any>(null)
    const [loading, setLoading] = useState(false)
    const { theme, toggleTheme } = useTheme()

    useEffect(() => {
        loadConfig()
        loadStats()
    }, [])

    const loadConfig = async () => {
        const cfg = await window.electronAPI.getConfig()
        setConfig(cfg)
    }

    const loadStats = async () => {
        const st = await window.electronAPI.getStorageStats()
        setStats(st)
    }

    const handleToggleAutoSave = async () => {
        const newConfig = { ...config, autoSaveEnabled: !config.autoSaveEnabled }
        await window.electronAPI.saveConfig(newConfig)
        setConfig(newConfig)
    }

    const handleProxyChange = async (proxy: string) => {
        const newConfig = { ...config, proxy }
        await window.electronAPI.saveConfig(newConfig)
        setConfig(newConfig)
    }

    const handleExportData = async () => {
        setLoading(true)
        try {
            const data = await window.electronAPI.exportConversations()
            const dataStr = JSON.stringify(data, null, 2)
            const blob = new Blob([dataStr], { type: 'application/json' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `chat-memo-export-${new Date().toISOString().split('T')[0]}.json`
            a.click()
            URL.revokeObjectURL(url)
        } catch (error) {
            console.error('Export failed:', error)
            alert('Failed to export data')
        } finally {
            setLoading(false)
        }
    }

    const handleClearAllData = async () => {
        if (confirm('Are you sure you want to delete all conversations and messages? This action cannot be undone.')) {
            setLoading(true)
            try {
                await window.electronAPI.clearAllData()
                loadStats()
                alert('All data cleared successfully')
            } catch (error) {
                console.error('Clear failed:', error)
                alert('Failed to clear data')
            } finally {
                setLoading(false)
            }
        }
    }

    if (!config || !stats) {
        return <div className="flex-1 flex items-center justify-center text-gray-400">Loading...</div>
    }

    return (
        <div className="flex-1 overflow-y-auto p-8 bg-surface-light dark:bg-gray-950 custom-scrollbar transition-colors duration-200">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8 flex items-center gap-3">
                <SettingsIcon size={32} />
                Settings
            </h1>

            {/* Appearance Settings */}
            <section className="mb-8 bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-800 shadow-sm">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Appearance</h2>

                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700">
                    <div>
                        <h3 className="text-gray-900 dark:text-white font-medium flex items-center gap-2">
                            {theme === 'light' ? <Sun size={18} /> : <Moon size={18} />}
                            Theme Mode
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Toggle between light and dark mode</p>
                    </div>
                    <button
                        onClick={toggleTheme}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${theme === 'dark' ? 'bg-blue-600' : 'bg-gray-300'}`}
                    >
                        <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${theme === 'dark' ? 'translate-x-6' : 'translate-x-1'}`}
                        />
                    </button>
                </div>
            </section>

            {/* Basic Settings */}
            <section className="mb-8 bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-800 shadow-sm">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Basic Settings</h2>

                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700">
                    <div>
                        <h3 className="text-gray-900 dark:text-white font-medium">Auto-save Conversations</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Automatically save conversations from supported platforms</p>
                    </div>
                    <button
                        onClick={handleToggleAutoSave}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${config.autoSaveEnabled ? 'bg-blue-600' : 'bg-gray-300'}`}
                    >
                        <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${config.autoSaveEnabled ? 'translate-x-6' : 'translate-x-1'}`}
                        />
                    </button>
                </div>
            </section>

            {/* Storage Management */}
            <section className="mb-8 bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-800 shadow-sm">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <Database size={20} />
                    Storage Management
                </h2>

                <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-100 dark:border-gray-700">
                        <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.conversationCount}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">Conversations</div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-100 dark:border-gray-700">
                        <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.messageCount}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">Messages</div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-100 dark:border-gray-700">
                        <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{stats.sizeInMB} MB</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">Database Size</div>
                    </div>
                </div>

                <button
                    onClick={async () => {
                        if (confirm('Re-index all messages for search? This may take a few moments.')) {
                            setLoading(true)
                            try {
                                const result = await window.electronAPI.reindexMessages()
                                alert(`Successfully re-indexed ${result.count} messages!`)
                            } catch (error) {
                                console.error('Re-index failed:', error)
                                alert('Failed to re-index messages')
                            } finally {
                                setLoading(false)
                            }
                        }
                    }}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-400 disabled:opacity-50 text-white px-4 py-3 rounded-lg transition-colors font-medium shadow-sm mb-3"
                >
                    <Database size={18} />
                    Re-index Messages for Search
                </button>

                <button
                    onClick={handleClearAllData}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 disabled:bg-red-400 disabled:opacity-50 text-white px-4 py-3 rounded-lg transition-colors font-medium shadow-sm"
                >
                    <Trash2 size={18} />
                    Clear All Data
                </button>
            </section>

            {/* Data Export */}
            <section className="mb-8 bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-800 shadow-sm">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <Download size={20} />
                    Data Export
                </h2>

                <p className="text-gray-500 dark:text-gray-400 mb-4">Export all your conversations and messages to a JSON file for backup or migration.</p>

                <button
                    onClick={handleExportData}
                    disabled={loading}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-500 disabled:opacity-50 text-white px-4 py-3 rounded-lg transition-colors font-medium shadow-sm"
                >
                    <Download size={18} />
                    Export to JSON
                </button>
            </section>

            {/* Proxy Configuration */}
            <section className="mb-8 bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-800 shadow-sm">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <Globe size={20} />
                    Proxy Configuration
                </h2>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Proxy URL (HTTP/HTTPS)
                    </label>
                    <input
                        type="text"
                        value={config.proxy}
                        onChange={(e) => handleProxyChange(e.target.value)}
                        placeholder="http://127.0.0.1:7890"
                        className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
                    />
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Leave empty to disable proxy. Changes take effect on app restart.</p>
                </div>
            </section>

            {/* Supported Platforms */}
            <section className="bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-800 shadow-sm">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Supported Platforms</h2>

                <p className="text-gray-500 dark:text-gray-400 mb-4">The following AI platforms support automatic conversation saving:</p>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {config.supportedPlatforms.map((platform: string) => (
                        <div key={platform} className="bg-gray-50 dark:bg-gray-800 rounded-lg px-4 py-3 text-center border border-gray-100 dark:border-gray-700">
                            <span className="text-gray-700 dark:text-white capitalize">{platform}</span>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    )
}
