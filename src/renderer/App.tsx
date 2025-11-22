import { useState, useEffect } from 'react'
import { Sidebar } from './components/Sidebar'
import { CardGrid } from './components/CardGrid'
import { BrowserView } from './components/BrowserView'
import { ConversationDetail } from './components/ConversationDetail'
import { Settings } from './components/Settings'
import { SearchPage } from './components/SearchPage'
import { TitleBar } from './components/TitleBar'
import { ThemeProvider } from './context/ThemeContext'
import { clsx } from 'clsx'

type ViewState = 'home' | 'settings' | 'chat' | 'history' | 'search'

interface Session {
    id: string
    card: any
}

function AppContent() {
    const [view, setView] = useState<ViewState>('home')
    const [sessions, setSessions] = useState<Session[]>([])
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
    const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null)
    const [highlightMessageId, setHighlightMessageId] = useState<string | null>(null)
    const [searchKeywords, setSearchKeywords] = useState<string>('')
    const [injectorPath, setInjectorPath] = useState<string>('')

    useEffect(() => {
        window.electronAPI.getInjectorPath().then(setInjectorPath)
    }, [])

    // Hide loading animation when app is ready
    useEffect(() => {
        const loader = document.getElementById('app-loader')
        if (loader) {
            // Fade out animation
            loader.style.opacity = '0'
            // Remove from DOM after transition
            setTimeout(() => {
                loader.remove()
            }, 500)
        }
    }, [])

    const handleNavigate = (newView: ViewState, conversationId?: string, messageId?: string, keywords?: string) => {
        if (newView === 'history' && conversationId) {
            setActiveHistoryId(conversationId)
            setHighlightMessageId(messageId || null)
            setSearchKeywords(keywords || '')
            setView('history')
        } else {
            setView(newView)
        }
    }

    const handleCardSelect = (card: any) => {
        const existingSession = sessions.find(s => s.card.id === card.id)

        if (existingSession) {
            setActiveSessionId(existingSession.id)
        } else {
            const newSession: Session = { id: card.id, card }
            setSessions(prev => [...prev, newSession])
            setActiveSessionId(newSession.id)
        }
        setView('chat')
    }

    const handleCloseSession = (e: React.MouseEvent, sessionId: string) => {
        e.stopPropagation()
        setSessions(prev => prev.filter(s => s.id !== sessionId))
        if (activeSessionId === sessionId) {
            setActiveSessionId(null)
            setView('home')
        }
    }

    const handleActivateSession = (sessionId: string) => {
        setActiveSessionId(sessionId)
        setView('chat')
    }

    return (
        <div className="flex flex-col h-screen w-screen bg-background-light dark:bg-background-dark text-gray-900 dark:text-gray-100 overflow-hidden transition-colors duration-200">
            <TitleBar />

            <div className="flex flex-1 overflow-hidden relative">
                <div className="flex-1 flex flex-col h-full overflow-hidden relative">
                    {/* Home View */}
                    <div className={clsx("flex-1 overflow-y-auto h-full", view !== 'home' && "hidden")}>
                        <CardGrid onSelectCard={handleCardSelect} />
                    </div>

                    {/* History View */}
                    {view === 'history' && activeHistoryId && (
                        <div className="flex-1 h-full overflow-hidden">
                            <ConversationDetail
                                conversationId={activeHistoryId}
                                highlightMessageId={highlightMessageId}
                                searchKeywords={searchKeywords}
                                onBack={() => setView('home')}
                            />
                        </div>
                    )}

                    {/* Search View */}
                    {view === 'search' && (
                        <div className="flex-1 h-full overflow-hidden">
                            <SearchPage onNavigate={handleNavigate} />
                        </div>
                    )}

                    {/* Chat View */}
                    {sessions.map(session => (
                        <div
                            key={session.id}
                            className={clsx(
                                "flex-1 flex flex-col h-full",
                                (view !== 'chat' || activeSessionId !== session.id) && "hidden"
                            )}
                        >
                            <BrowserView
                                url={session.card.url}
                                cardId={session.card.id}
                                injectorPath={injectorPath}
                            />
                        </div>
                    ))}

                    {view === 'chat' && !activeSessionId && (
                        <div className="flex-1 flex items-center justify-center text-gray-500">
                            Select a conversation or start a new one
                        </div>
                    )}

                    {/* Settings View */}
                    {view === 'settings' && <Settings />}
                </div>

                <div className="h-full">
                    <Sidebar
                        onNavigate={handleNavigate}
                        sessions={sessions}
                        activeSessionId={activeSessionId}
                        onActivateSession={handleActivateSession}
                        onCloseSession={handleCloseSession}
                        activeConversationId={view === 'history' ? activeHistoryId : undefined}
                    />
                </div>
            </div>
        </div>
    )
}

function App() {
    return (
        <ThemeProvider>
            <AppContent />
        </ThemeProvider>
    )
}

export default App
