import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'

interface Card {
    id: string
    name: string
    url: string
    proxyNode?: string
}

interface CardGridProps {
    onSelectCard: (card: Card) => void
}

export function CardGrid({ onSelectCard }: CardGridProps) {
    const [cards, setCards] = useState<Card[]>([])
    const [supportedPlatforms, setSupportedPlatforms] = useState<string[]>([])

    useEffect(() => {
        loadConfig()
    }, [])

    const loadConfig = async () => {
        const config = await window.electronAPI.getConfig()
        setCards(config.cards)
        setSupportedPlatforms(config.supportedPlatforms || [])
    }

    const isSupported = (cardId: string) => {
        return supportedPlatforms.includes(cardId)
    }

    return (
        <div className="p-8 h-full overflow-y-auto custom-scrollbar bg-surface-light dark:bg-gray-950 transition-colors duration-200">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">AI Platforms</h1>
            <p className="text-gray-600 dark:text-gray-400 mb-8">Select a platform to start chatting. Platforms with <Check size={14} className="inline text-green-500" /> support auto-save.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {cards.map(card => (
                    <div
                        key={card.id}
                        onClick={() => onSelectCard(card)}
                        className="bg-white dark:bg-gray-900 p-6 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-blue-500 dark:hover:border-blue-500 cursor-pointer transition-all hover:shadow-lg hover:shadow-blue-500/10 group relative"
                    >
                        {isSupported(card.id) && (
                            <div className="absolute top-3 right-3 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 p-1.5 rounded-full" title="Auto-save supported">
                                <Check size={14} />
                            </div>
                        )}
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{card.name}</h3>
                            {card.proxyNode && (
                                <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-2 py-1 rounded border border-gray-200 dark:border-gray-700">
                                    {card.proxyNode}
                                </span>
                            )}
                        </div>
                        <p className="text-gray-500 dark:text-gray-400 text-sm truncate">{card.url}</p>
                    </div>
                ))}
            </div>
        </div>
    )
}
