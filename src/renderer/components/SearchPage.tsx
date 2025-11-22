import React, { useState, useEffect } from 'react'
import { clsx } from 'clsx'
import { SearchQuery } from '../../preload/types'

interface SearchResult {
    id: string // 消息的唯一标识符
    content: string // 消息的原始内容
    thinking?: string // AI思考过程（可选）
    created_at: string // 消息创建时间
    sender: 'user' | 'AI' // 消息发送者：用户或AI
    platform: string // 消息所属平台
    title: string // 对话标题
    conversation_id: string // 对话的唯一标识符
    snippet: string // 消息内容的摘要或片段
}



interface SearchPageProps {
    onNavigate: (view: 'history', conversationId: string, messageId?: string, keywords?: string) => void
}

// Platform configuration with colors
const PLATFORMS = [
    { id: 'chatgpt', name: 'ChatGPT', color: 'green' },
    { id: 'copilot', name: 'Copilot', color: 'blue' },
    { id: 'gemini', name: 'Gemini', color: 'purple' },
    { id: 'yuanbao', name: 'Yuanbao', color: 'red' },
    { id: 'doubao', name: 'Doubao', color: 'orange' },
    { id: 'deepseek', name: 'DeepSeek', color: 'indigo' },
    { id: 'kimi', name: 'Kimi', color: 'pink' },
    { id: 'qwen', name: 'Qwen', color: 'cyan' },
] as const

const PLATFORM_COLORS = {
    green: {
        active: 'bg-green-100 border-green-500 text-green-700 dark:bg-green-900/30 dark:text-green-400',
        inactive: 'border-gray-300 dark:border-gray-700 hover:border-green-400 dark:hover:border-green-500'
    },
    blue: {
        active: 'bg-blue-100 border-blue-500 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
        inactive: 'border-gray-300 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500'
    },
    purple: {
        active: 'bg-purple-100 border-purple-500 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
        inactive: 'border-gray-300 dark:border-gray-700 hover:border-purple-400 dark:hover:border-purple-500'
    },
    red: {
        active: 'bg-red-100 border-red-500 text-red-700 dark:bg-red-900/30 dark:text-red-400',
        inactive: 'border-gray-300 dark:border-gray-700 hover:border-red-400 dark:hover:border-red-500'
    },
    orange: {
        active: 'bg-orange-100 border-orange-500 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
        inactive: 'border-gray-300 dark:border-gray-700 hover:border-orange-400 dark:hover:border-orange-500'
    },
    indigo: {
        active: 'bg-indigo-100 border-indigo-500 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
        inactive: 'border-gray-300 dark:border-gray-700 hover:border-indigo-400 dark:hover:border-indigo-500'
    },
    pink: {
        active: 'bg-pink-100 border-pink-500 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
        inactive: 'border-gray-300 dark:border-gray-700 hover:border-pink-400 dark:hover:border-pink-500'
    },
    cyan: {
        active: 'bg-cyan-100 border-cyan-500 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
        inactive: 'border-gray-300 dark:border-gray-700 hover:border-cyan-400 dark:hover:border-cyan-500'
    }
}

export function SearchPage({ onNavigate }: SearchPageProps) {
    const [keyword, setKeyword] = useState('')
    const [results, setResults] = useState<SearchResult[]>([])
    const [loading, setLoading] = useState(false)
    const [filters, setFilters] = useState<SearchQuery['filters']>({
        platform: [],
        sender: undefined
    })

    const handleSearch = async () => {
        // Allow search even with empty keyword to show all results
        setLoading(true)
        try {
            const query: SearchQuery = {
                keyword: keyword.trim() || ' ', // Use space if empty to get all results
                filters,
                options: {
                    limit: 50,
                    offset: 0,
                    highlight: true
                }
            }
            const data = await window.electronAPI.advancedSearch(query)
            setResults(data)
        } catch (error) {
            console.error('Search failed:', error)
        } finally {
            setLoading(false)
        }
    }

    // Auto-search when filters change
    useEffect(() => {
        if (keyword.trim()) {
            handleSearch()
        }
    }, [filters])

    // Debounced search on keyword change
    useEffect(() => {
        const timer = setTimeout(() => {
            if (keyword.trim()) {
                handleSearch()
            } else {
                // Clear results when keyword is empty
                setResults([])
            }
        }, 300) // 300ms debounce

        return () => clearTimeout(timer)
    }, [keyword])

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSearch()
        }
    }

    const togglePlatformFilter = (platform: string) => {
        setFilters(prev => {
            const current = prev?.platform || []
            const next = current.includes(platform)
                ? current.filter(p => p !== platform)
                : [...current, platform]
            return { ...prev, platform: next }
        })
    }

    const handleResultClick = async (conversationId: string, messageId: string) => {
        console.log('handleResultClick', conversationId, messageId)
    
        try {
            const tokens = await window.electronAPI.tokenize(keyword)
            
            // 根据返回类型处理
            let tokenString: string
            
            if (Array.isArray(tokens)) {
                tokenString = tokens.join(' ')
            } else if (typeof tokens === 'string') {
                tokenString = tokens
            } else {
                // 其他情况回退到原始关键词
                tokenString = keyword || ''
                console.warn('Unexpected tokens type:', typeof tokens, tokens)
            }
            
            onNavigate('history', conversationId, messageId, tokenString)
        } catch (error) {
            console.error('Tokenization failed:', error)
            onNavigate('history', conversationId, messageId, keyword || '')
        }
    }

    return (
        <div className="flex flex-col h-full bg-background-light dark:bg-background-dark p-6 overflow-hidden">
            <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100">Vertical Search Engine</h1>

            {/* Search Bar */}
            <div className="flex gap-4 mb-6">
                <div className="flex-1 relative">
                    <input
                        type="text"
                        value={keyword}
                        onChange={(e) => setKeyword(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Search your AI conversations..."
                        className="w-full px-4 py-3 rounded-xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark focus:ring-2 focus:ring-primary-500 outline-none text-lg"
                    />
                    <button
                        onClick={handleSearch}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </button>
                </div>
            </div>


            {/* Filters */}
            <div className="mb-6 space-y-4">
                {/* Platform Filters */}
                <div>
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Platforms:</span>
                        {filters?.platform && filters.platform.length > 0 && (
                            <button
                                onClick={() => setFilters(prev => ({ ...prev, platform: [] }))}
                                className="text-xs text-gray-500 dark:text-gray-400 hover:text-primary-500 dark:hover:text-primary-400 transition-colors"
                            >
                                Clear All
                            </button>
                        )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {PLATFORMS.map(platform => {
                            const isActive = filters?.platform?.includes(platform.id)
                            const colors = PLATFORM_COLORS[platform.color]
                            return (
                                <button
                                    key={platform.id}
                                    onClick={() => togglePlatformFilter(platform.id)}
                                    className={clsx(
                                        "px-3 py-1.5 rounded-full border transition-all text-sm font-medium",
                                        isActive ? colors.active : colors.inactive
                                    )}
                                >
                                    {platform.name}
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* Sender Filter */}
                <div>
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 block mb-3">Sender:</span>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setFilters(prev => ({ ...prev, sender: undefined }))}
                            className={clsx(
                                "px-4 py-1.5 rounded-full border transition-all text-sm font-medium",
                                !filters?.sender
                                    ? "bg-gray-200 border-gray-400 text-gray-800 dark:bg-gray-700 dark:border-gray-500 dark:text-gray-200"
                                    : "border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600"
                            )}
                        >
                            All
                        </button>
                        <button
                            onClick={() => setFilters(prev => ({ ...prev, sender: 'user' }))}
                            className={clsx(
                                "px-4 py-1.5 rounded-full border transition-all text-sm font-medium",
                                filters?.sender === 'user'
                                    ? "bg-blue-100 border-blue-500 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                                    : "border-gray-300 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500"
                            )}
                        >
                            User
                        </button>
                        <button
                            onClick={() => setFilters(prev => ({ ...prev, sender: 'AI' }))}
                            className={clsx(
                                "px-4 py-1.5 rounded-full border transition-all text-sm font-medium",
                                filters?.sender === 'AI'
                                    ? "bg-purple-100 border-purple-500 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                                    : "border-gray-300 dark:border-gray-700 hover:border-purple-400 dark:hover:border-purple-500"
                            )}
                        >
                            AI
                        </button>
                    </div>
                </div>
            </div>


            {/* 结果区域 */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                {loading ? (
                    // 加载中状态显示
                    <div className="text-center py-10 text-gray-500">搜索中...</div>
                ) : results.length === 0 ? (
                    // 没有搜索结果时显示
                    <div className="text-center py-10 text-gray-500">未找到结果</div>
                ) : (
                    // 遍历并渲染每个搜索结果
                    results.map((item) => (
                        <div
                            key={item.id} // 唯一键
                            onClick={() => handleResultClick(item.conversation_id, item.id)} // 点击结果时的处理函数
                            className="p-4 rounded-xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark hover:border-primary-500 transition-colors cursor-pointer group"
                        >
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center gap-2">
                                    {/* 平台标签 (ChatGPT 或 Claude) */}
                                    <span className={clsx(
                                        "text-xs px-2 py-0.5 rounded font-medium uppercase",
                                        item.platform === 'chatgpt' ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                                    )}>
                                        {item.platform}
                                    </span>
                                    {/* 创建时间 */}
                                    <span className="text-xs text-gray-500">
                                        {new Date(item.created_at).toLocaleString()}
                                    </span>
                                    {/* 发送者标签 (用户 或 AI) */}
                                    <span className={clsx(
                                        "text-xs px-2 py-0.5 rounded font-medium",
                                        item.sender === 'user' ? "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200" : "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
                                    )}>
                                        {item.sender}
                                    </span>
                                </div>
                            </div>

                            {/* 结果标题 */}
                            <h3 className="font-semibold text-lg mb-2 text-gray-800 dark:text-gray-200 group-hover:text-primary-500 transition-colors">
                                {item.title || '无标题对话'} {/* 如果没有标题则显示“无标题对话” */}
                            </h3>

                            {/* 结果摘要/片段，使用 dangerouslySetInnerHTML 渲染 HTML 内容 */}
                            <div
                                className="text-sm text-gray-600 dark:text-gray-300 line-clamp-3 leading-relaxed"
                                dangerouslySetInnerHTML={{ __html: item.snippet }}
                            />
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}
