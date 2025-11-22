import { useEffect, useState, useRef } from 'react'
import { ArrowLeft, Calendar, MessageSquare, User, Bot, Clock } from 'lucide-react'
import { clsx } from 'clsx'

interface Message {
    messageId: string
    sender: 'user' | 'AI' | 'unknown'
    content: string
    thinking?: string
    createdAt: string
}

interface Conversation {
    id: string
    platform: string
    title: string
    messages: Message[]
    createdAt: string
    updatedAt: string
}

interface ConversationDetailProps {
    conversationId: string
    highlightMessageId?: string | null
    searchKeywords?: string
    onBack: () => void
}

export function ConversationDetail({ conversationId, highlightMessageId, searchKeywords, onBack }: ConversationDetailProps) {
    const [conversation, setConversation] = useState<Conversation | null>(null)
    const [loading, setLoading] = useState(true)
    const messageRefs = useRef<{ [key: string]: HTMLDivElement | null }>({})

    useEffect(() => {
        const loadConversation = async () => {
            setLoading(true)
            try {
                const data = await window.electronAPI.getConversation(conversationId)
                setConversation(data)
            } catch (error) {
                console.error('Failed to load conversation:', error)
            } finally {
                setLoading(false)
            }
        }

        if (conversationId) {
            loadConversation()
        }
    }, [conversationId])

    // Scroll to highlighted message after conversation loads
    useEffect(() => {
        if (highlightMessageId && conversation && messageRefs.current[highlightMessageId]) {
            // Wait a bit for DOM to settle
            setTimeout(() => {
                messageRefs.current[highlightMessageId]?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center'
                })
            }, 100)
        }
    }, [highlightMessageId, conversation])

    // Helper function to highlight keywords in text
    const highlightText = (text: string): string => {
        if (!searchKeywords) return text

        const keywords = searchKeywords.split(' ').filter(k => k.trim())
        let result = text

        for (const keyword of keywords) {
            const regex = new RegExp(`(${keyword})`, 'gi')
            result = result.replace(regex, '<mark class="bg-yellow-300 dark:bg-yellow-600 px-1 rounded">$1</mark>')
        }

        return result
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full bg-background-light dark:bg-background-dark">
                <div className="flex flex-col items-center gap-3">
                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-500 border-t-transparent"></div>
                    <p className="text-gray-600 dark:text-gray-400 text-sm">Loading conversation...</p>
                </div>
            </div>
        )
    }

    if (!conversation) {
        return (
            <div className="flex flex-col items-center justify-center h-full bg-background-light dark:bg-background-dark">
                <div className="text-center space-y-4">
                    <div className="text-6xl mb-4">💬</div>
                    <p className="text-gray-600 dark:text-gray-400 text-lg">Conversation not found</p>
                    <button
                        onClick={onBack}
                        className="px-6 py-2.5 bg-primary-500 hover:bg-primary-600 rounded-lg text-white font-medium transition-colors shadow-lg hover:shadow-xl"
                    >
                        Go Back
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-col h-full bg-background-light dark:bg-background-dark transition-colors duration-200">
            {/* Header */}
            <div className="flex items-center gap-4 p-4 border-b border-border-light dark:border-border-dark bg-surface-light/80 dark:bg-surface-dark/80 backdrop-blur-md sticky top-0 z-10 shadow-sm">
                <button
                    onClick={onBack}
                    className="p-2.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-all text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white group"
                    aria-label="Go back"
                >
                    <ArrowLeft size={20} className="group-hover:-translate-x-0.5 transition-transform" />
                </button>
                <div className="flex-1 min-w-0">
                    <h2 className="text-lg font-bold truncate text-gray-900 dark:text-white">
                        {conversation.title || 'Untitled Conversation'}
                    </h2>
                    <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-1">
                        <span className="flex items-center gap-1.5 px-2 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 rounded-full">
                            <MessageSquare size={12} />
                            {conversation.platform}
                        </span>
                        <span className="flex items-center gap-1.5">
                            <Calendar size={12} />
                            {new Date(conversation.createdAt).toLocaleDateString()}
                        </span>
                        <span className="flex items-center gap-1.5">
                            <Clock size={12} />
                            {new Date(conversation.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    </div>
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                {conversation.messages.map((msg, index) => (
                    <div
                        key={msg.messageId}
                        ref={(el) => (messageRefs.current[msg.messageId] = el)}
                        className={clsx(
                            "flex gap-4 max-w-5xl mx-auto transition-all duration-300 animate-fadeIn",
                            msg.sender === 'user' ? "flex-row-reverse" : "flex-row",
                            highlightMessageId === msg.messageId && "ring-2 ring-yellow-400 dark:ring-yellow-500 rounded-2xl p-3 bg-yellow-50/50 dark:bg-yellow-900/10"
                        )}
                        style={{ animationDelay: `${index * 50}ms` }}
                    >
                        {/* Avatar */}
                        <div className={clsx(
                            "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 shadow-md",
                            msg.sender === 'user'
                                ? "bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700"
                                : "bg-gradient-to-br from-purple-500 to-purple-600 dark:from-purple-600 dark:to-purple-700"
                        )}>
                            {msg.sender === 'user' ? <User size={18} className="text-white" /> : <Bot size={18} className="text-white" />}
                        </div>

                        {/* Content */}
                        <div className={clsx(
                            "flex flex-col min-w-0 flex-1",
                            msg.sender === 'user' ? "items-end" : "items-start"
                        )}>
                            {/* Message Bubble */}
                            <div className={clsx(
                                "rounded-2xl px-5 py-3.5 text-sm leading-relaxed shadow-md relative max-w-[85%]",
                                msg.sender === 'user'
                                    ? "bg-blue-100 dark:bg-blue-800 text-gray-900 dark:text-white rounded-tr-sm"
                                    : "bg-purple-100 dark:bg-purple-800 text-gray-900 dark:text-white rounded-tl-sm"
                            )}>
                                {/* Thinking Block */}
                                {msg.thinking && (
                                    <div className={clsx(
                                        "mb-3 text-xs border-l-2 pl-3 py-1 italic",
                                        msg.sender === 'user'
                                            ? "border-blue-300 text-blue-100"
                                            : "border-gray-400 dark:border-gray-600 text-gray-600 dark:text-gray-400"
                                    )}>
                                        💭 {msg.thinking}
                                    </div>
                                )}

                                {/* Message Content with Highlighting */}
                                <div
                                    className="whitespace-pre-wrap break-words prose prose-sm dark:prose-invert max-w-none"
                                    dangerouslySetInnerHTML={{ __html: highlightText(msg.content) }}
                                />
                            </div>

                            {/* Timestamp */}
                            <div className={clsx(
                                "mt-1.5 text-xs px-2 flex items-center gap-1",
                                msg.sender === 'user'
                                    ? "text-gray-500 dark:text-gray-500"
                                    : "text-gray-500 dark:text-gray-500"
                            )}>
                                <Clock size={10} />
                                {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                        </div>
                    </div>
                ))}

                {/* End Indicator */}
                <div className="text-center py-4">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-full text-xs text-gray-500 dark:text-gray-400">
                        <div className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-600"></div>
                        <span>End of conversation</span>
                        <div className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-600"></div>
                    </div>
                </div>
            </div>
        </div>
    )
}
