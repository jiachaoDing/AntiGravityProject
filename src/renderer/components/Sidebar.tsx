import React, { useState, useEffect, useRef } from 'react' // 引入 React 核心库，以及 useState、useEffect 和 useRef Hooks
import { Search, MessageSquare, Settings, ChevronLeft, ChevronRight, Home } from 'lucide-react' // 引入来自 lucide-react 的图标组件
import { clsx } from 'clsx' // 引入 clsx 工具函数，用于条件性地拼接 CSS 类名

import { X } from 'lucide-react' // 引入关闭图标

/**
 * @file Sidebar.tsx
 * @description 这是一个侧边栏组件，用于显示导航链接、活动会话和最近的聊天记录。
 *              它支持折叠/展开、搜索功能，并允许用户在不同视图（如主页、设置、聊天）之间切换。
 *              同时，它还管理会话的激活和关闭。
 */

// 定义 Sidebar 组件的属性接口
type SidebarView = 'home' | 'settings' | 'chat' | 'history' | 'search'

interface SidebarProps {
  onNavigate: (view: SidebarView, id?: string, messageId?: string, keywords?: string) => void
  sessions?: any[]
  activeSessionId?: string | null
  onActivateSession?: (id: string) => void
  onCloseSession?: (e: React.MouseEvent, id: string) => void
  activeConversationId?: string | null
}

export function Sidebar({
  onNavigate,
  sessions = [],
  activeSessionId,
  onActivateSession,
  onCloseSession,
  activeConversationId
}: SidebarProps) {
  const [conversations, setConversations] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [collapsed, setCollapsed] = useState(false)
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean
    x: number
    y: number
    conversationId: string | null
  }>({ visible: false, x: 0, y: 0, conversationId: null })

  // Search state
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)

  // 定义一个状态变量 `view` 和一个更新 `view` 的函数 `setView`。
  // `view` 的初始值被设置为 `'home'`。
  // `<SidebarView>` 是一个类型参数，指定 `view` 状态变量的类型必须是 `SidebarView`。
  // `SidebarView` 类型在文件顶部定义，它是一个联合类型，包含 `'home'`, `'settings'`, `'chat'`, `'history'`, `'search'` 等字符串字面量。
  // 这个状态变量用于控制侧边栏当前显示的内容或模式。
  const [view, setView] = useState<SidebarView>('home')

  // 跟踪高亮的对话 ID
  const [highlightedIds, setHighlightedIds] = useState<Set<string>>(new Set())
  // 使用 ref 跟踪之前的对话列表，用于检测更新
  const prevConversationsRef = useRef<any[]>([])
  // Track first load to prevent initial highlight
  const isFirstLoad = useRef(true)

  useEffect(() => {
    loadConversations()

    // Subscribe to real-time updates
    const cleanup = window.electronAPI.onConversationUpdate(() => {
      console.log('Received conversation update, refreshing list...')
      loadConversations()
    })

    return cleanup
  }, [])

  const loadConversations = async () => {
    const recents = await window.electronAPI.getRecentConversations()

    // 检测新增或更新的对话
    const prevConvs = prevConversationsRef.current
    const newHighlights = new Set<string>()

    recents.forEach(conv => {
      const prevConv = prevConvs.find(p => p.id === conv.id)

      // 如果是新对话或者更新时间变化了，则高亮
      if (!prevConv || new Date(conv.updated_at).getTime() !== new Date(prevConv.updated_at).getTime()) {
        newHighlights.add(conv.id)
      }
    })

    // 更新状态
    setConversations(recents)
    prevConversationsRef.current = recents

    // 如果有新的高亮项，设置高亮并在 2 秒后移除
    if (newHighlights.size > 0) {
      if (!isFirstLoad.current) {
        setHighlightedIds(newHighlights)
        setTimeout(() => {
          setHighlightedIds(new Set())
        }, 2000)
      }
    }

    isFirstLoad.current = false
  }

  const handleSearchInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
  }

  const handleClearSearch = () => {
    setSearchQuery('')
    setSearching(false)
    setSearchResults([])
  }

  const performSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      setSearching(false)
      return
    }

    setSearching(true)
    try {
      const query = {
        keyword: searchQuery.trim(),
        filters: { platform: [], sender: undefined },
        options: {
          limit: 50,
          offset: 0,
          highlight: true
        }
      }
      const data = await window.electronAPI.advancedSearch(query)
      setSearchResults(data)
    } catch (error) {
      console.error('Search failed:', error)
    } finally {
      setSearching(false)
    }
  }

  // Debounced search on keyword change
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim()) {
        performSearch()
      } else {
        setSearchResults([])
        setSearching(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery])

  const handleDeleteConversation = async (conversationId: string) => {
    if (confirm('Are you sure you want to delete this conversation?')) {
      try {
        await window.electronAPI.deleteConversation(conversationId)
        setContextMenu({ visible: false, x: 0, y: 0, conversationId: null })
        // The conversation list will refresh automatically via onConversationUpdate
      } catch (error) {
        console.error('Failed to delete conversation:', error)
        alert('Failed to delete conversation')
      }
    }
  }

  const handleContextMenu = (e: React.MouseEvent, conversationId: string) => {
    e.preventDefault()
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      conversationId
    })
  }

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (contextMenu.visible) {
        setContextMenu({ visible: false, x: 0, y: 0, conversationId: null })
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [contextMenu.visible])

  return (
    <div
      className={clsx(
        "bg-surface-light dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 flex flex-col h-full transition-all duration-300 ease-in-out relative",
        collapsed ? "w-16" : "w-64"
      )}
    >
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -left-3 top-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full p-1 text-gray-500 dark:text-gray-400 hover:text-blue-500 dark:hover:text-white z-50 shadow-sm transition-colors"
      >
        {collapsed ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
      </button>

      <div className="flex flex-col h-full overflow-hidden w-full">
        <div className="p-4 border-b border-gray-200 dark:border-gray-800">
          <div className={clsx("flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-lg px-3 py-2 transition-all duration-300", collapsed ? "justify-center px-2" : "")}>
            <Search size={16} className="text-gray-400 flex-shrink-0" />
            <input
              type="text"
              placeholder="Search..."
              className={clsx(
                "bg-transparent border-none outline-none text-sm text-gray-900 dark:text-white placeholder-gray-400 transition-all duration-300 ease-in-out",
                collapsed ? "w-0 opacity-0 p-0" : "w-full opacity-100 min-w-0"
              )}
              value={searchQuery}
              onChange={handleSearchInput}
            />
            {!collapsed && searchQuery && (
              <button
                onClick={handleClearSearch}
                className="flex-shrink-0 p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                title="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Fixed Header Section - Home & Search Buttons */}
        <div className="p-2 border-b border-gray-200 dark:border-gray-800 space-y-1">
          <div
            className={clsx(
              "p-2 rounded-lg cursor-pointer transition-all flex items-center gap-3 overflow-hidden",
              view === 'home'
                ? "bg-blue-500 text-white shadow-md shadow-blue-500/20"
                : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white",
              collapsed && "justify-center"
            )}
            onClick={() => {
              setView('home');
              onNavigate('home');
            }}
            title="Home"
          >
            <Home size={20} className="flex-shrink-0" />
            <span className={clsx("font-medium whitespace-nowrap transition-all duration-300", collapsed ? "w-0 opacity-0" : "w-auto opacity-100")}>Home</span>
          </div>

          <div
            className={clsx(
              "p-2 rounded-lg cursor-pointer transition-all flex items-center gap-3 overflow-hidden",
              view == 'search'
                ? "bg-blue-500 text-white shadow-md shadow-blue-500/20"
                : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white",
              collapsed && "justify-center"
            )}
            onClick={() => {
              setView('search');
              onNavigate('search')
            }}
            title="Advanced Search"
          >
            <Search size={20} className="flex-shrink-0" />
            <span className={clsx("font-medium whitespace-nowrap transition-all duration-300", collapsed ? "w-0 opacity-0" : "w-auto opacity-100")}>Search</span>
          </div>
        </div>

        {/* Fixed Active Sessions Section */}
        {sessions.length > 0 && (
          <div className="p-2 border-b border-gray-200 dark:border-gray-800">
            <div className={clsx("text-xs font-semibold text-gray-500 uppercase tracking-wider overflow-hidden whitespace-nowrap transition-all duration-300", collapsed ? "h-0 opacity-0 mb-0" : "h-auto opacity-100 mb-2 px-2")}>
              Active Sessions
            </div>

            {sessions.map(session => (
              <div
                key={session.id}
                className={clsx(
                  "p-2 rounded-lg cursor-pointer flex items-center gap-3 mb-1 group relative transition-all overflow-hidden",
                  activeSessionId === session.id
                    ? "bg-white dark:bg-gray-800 border border-blue-500/30 text-blue-500 dark:text-blue-400 shadow-sm"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800",
                  collapsed && "justify-center"
                )}
                title={`Active: ${session.card.name}`}
                onClick={() => onActivateSession?.(session.id)}
              >
                <div
                  className={clsx(
                    "flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white",
                    "bg-blue-500 dark:bg-blue-600",
                    activeSessionId === session.id && "animate-pulse"
                  )}
                >
                  {session.card.name.charAt(0).toUpperCase()}
                </div>
                <div className={clsx("overflow-hidden flex-1 transition-all duration-300", collapsed ? "w-0 opacity-0" : "w-auto opacity-100")}>
                  <div className="text-sm font-medium truncate">{session.card.name}</div>
                </div>

                <button
                  className={clsx("p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-400 hover:text-red-500 transition-all", collapsed ? "hidden" : "opacity-0 group-hover:opacity-100")}
                  onClick={(e) => onCloseSession?.(e, session.id)}
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Scrollable Recent Chats Area */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar overflow-x-hidden">
          <div className={clsx("text-xs font-semibold text-gray-500 uppercase tracking-wider overflow-hidden whitespace-nowrap transition-all duration-300", collapsed ? "h-0 opacity-0 mb-0" : "h-auto opacity-100 mb-2 px-2")}>
            {searchQuery.trim() ? 'Search Results' : 'Recent Chats'}
          </div>

          {searching ? (
            <div className={clsx("text-center py-4 text-xs text-gray-500", collapsed && "hidden")}>
              Searching...
            </div>
          ) : searchQuery.trim() && searchResults.length === 0 ? (
            <div className={clsx("text-center py-4 text-xs text-gray-500", collapsed && "hidden")}>
              No results found
            </div>
          ) : (
            (searchQuery.trim() ? searchResults : conversations).map(item => {
              // Determine if this is a search result or a regular conversation
              const isSearchResult = searchQuery.trim() && 'conversation_id' in item
              const itemId = isSearchResult ? item.conversation_id : item.id
              const messageId = isSearchResult ? item.id : undefined

              return (
                <div
                  key={isSearchResult ? item.id : item.id}
                  className={clsx(
                    "p-3 rounded-lg cursor-pointer flex flex-col gap-1 group transition-all duration-200 border overflow-hidden",
                    activeConversationId === itemId
                      ? "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-sm"
                      : "border-transparent hover:bg-gray-100 dark:hover:bg-gray-800/50",
                    !isSearchResult && highlightedIds.has(item.id)
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-500/20 shadow-lg shadow-blue-500/50 animate-pulse-slow"
                      : "",
                    collapsed && "items-center"
                  )}
                  onClick={async () => {
                    setView('history');
                    if (isSearchResult) {
                      // For search results, navigate with messageId and tokenized keywords

                      try {
                        const tokens = await window.electronAPI.tokenize(searchQuery)
                        
                        // 根据返回类型处理
                        let tokenString: string
                        
                        if (Array.isArray(tokens)) {
                            tokenString = tokens.join(' ')
                        } else if (typeof tokens === 'string') {
                            tokenString = tokens
                        } else {
                            // 其他情况回退到原始关键词
                            tokenString = searchQuery || ''
                            console.warn('Unexpected tokens type:', typeof tokens, tokens)
                        }
                        onNavigate('history', itemId, messageId, tokenString)

                    } catch (error) {
                        console.error('Tokenization failed:', error)
                        onNavigate('history', itemId, messageId, searchQuery || '')
                    }

                    } else {
                      onNavigate('history', itemId)
                    }
                  }}
                  onContextMenu={(e) => !isSearchResult && handleContextMenu(e, item.id)}
                  title={item.title}
                >
                  <div className="flex items-center gap-2 w-full">
                    <MessageSquare size={16} className={clsx("flex-shrink-0", activeConversationId === itemId ? "text-blue-500 dark:text-blue-400" : "text-gray-400 dark:text-gray-500")} />
                    <div className={clsx("text-sm font-medium text-gray-700 dark:text-gray-200 truncate flex-1 transition-all duration-300", collapsed ? "w-0 opacity-0" : "w-auto opacity-100")}>
                      {item.title || 'New Chat'}
                    </div>
                  </div>

                  {isSearchResult ? (
                    // Search result display with snippet
                    <div className={clsx("transition-all duration-300 overflow-hidden", collapsed ? "h-0 opacity-0" : "h-auto opacity-100")}>
                      <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                        <span className="bg-gray-200 dark:bg-gray-800 px-1.5 py-0.5 rounded text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-700 uppercase text-[10px] tracking-wider">
                          {item.platform}
                        </span>
                        <span className={clsx(
                          "px-1.5 py-0.5 rounded text-[10px]",
                          item.sender === 'user' ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" : "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                        )}>
                          {item.sender}
                        </span>
                        <span className="text-[10px]">
                          {new Date(item.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div
                        className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: item.snippet }}
                      />
                    </div>
                  ) : (
                    // Regular conversation display
                    <div className={clsx("flex items-center justify-between text-xs text-gray-500 mt-1 transition-all duration-300 overflow-hidden", collapsed ? "h-0 opacity-0" : "h-auto opacity-100")}>
                      <div className="flex items-center gap-2">
                        <span className="bg-gray-200 dark:bg-gray-800 px-1.5 py-0.5 rounded text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-700 uppercase text-[10px] tracking-wider">
                          {item.platform}
                        </span>
                        <span className="flex items-center gap-1" title="Message Count">
                          {item.message_count || 0} msgs
                        </span>
                      </div>
                      <span title={new Date(item.updated_at).toLocaleString()}>
                        {new Date(item.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  )}
                </div>
              )
            }))}
        </div>

        {/* 底部区域 */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-800">
          {/* 设置导航按钮 */}
          <button
            className={clsx(
              "flex items-center gap-3 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white w-full p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors overflow-hidden", // 按钮样式
              view == 'settings'
                ? "bg-blue-500 text-white shadow-md shadow-blue-500/20"
                : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white",
              collapsed && "justify-center" // 折叠时居中
            )}
            onClick={
              () => {
                setView('settings');
                onNavigate('settings')
              }} // 点击时导航到设置视图
            title="Settings" // 鼠标悬停提示
          >
            <Settings size={20} className="flex-shrink-0" /> {/* 设置图标 */}
            <span className={clsx("whitespace-nowrap transition-all duration-300", collapsed ? "w-0 opacity-0" : "w-auto opacity-100")}>Settings</span>
          </button>
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu.visible && (
        <div
          className="fixed bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl py-1 z-50"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="w-full px-4 py-2 text-left text-sm text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
            onClick={() => contextMenu.conversationId && handleDeleteConversation(contextMenu.conversationId)}
          >
            <X size={14} />
            Delete Conversation
          </button>
        </div>
      )}
    </div>
  )
}
