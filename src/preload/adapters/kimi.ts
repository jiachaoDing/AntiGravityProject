import { BasePlatformAdapter } from '../core/base-adapter'
import type { ConversationInfo, Message } from '../types'

/**
 * Kimi Adapter for https://kimi.moonshot.cn or https://kimi.com
 * URL pattern: https://kimi.moonshot.cn/chat/{conversationId} or https://kimi.com/chat/{conversationId}
 */
export class KimiAdapter extends BasePlatformAdapter {
    public platform = 'kimi'

    public isValidConversationUrl(url: string): boolean {
        return (url.includes('kimi.moonshot.cn') || url.includes('kimi.com')) && url.includes('/chat/')
    }

    public extractConversationInfo(url: string): ConversationInfo {
        // Match pattern: https://kimi.moonshot.cn/chat/{id} or https://www.kimi.com/chat/{id}
        const match = url.match(/\/chat\/([a-zA-Z0-9_-]+)/)

        return {
            conversationId: match ? match[1] : null,
            isNewConversation: !match
        }
    }

    public extractMessages(): Message[] {
        const messages: Message[] = []

        // Find all message containers
        const chatContainer = document.querySelector('.chat-content-list')
        if (!chatContainer) return messages

        


        const messageElements = chatContainer.querySelectorAll('.chat-content-item')
        
        // 检查消息框内是否有正在编辑的文本输入，如果有则跳过提取，防止保存未完成或中间状态的内容
        const existTextarea = Array.from(messageElements).find(element => this.isInEditMode(element as HTMLElement));
        if (existTextarea) {
            console.log('KimiAdapter: User is editing, skipping extraction');
            return [];
        }
        
        messageElements.forEach((element, index) => {
            const isUser = element.classList.contains('chat-content-item-user')
            const isAssistant = element.classList.contains('chat-content-item-assistant')

            if (!isUser && !isAssistant) return

            
        // 检查消息框内是否有正在编辑的文本输入，如果有则跳过提取，防止保存未完成或中间状态的内容
            // Extract content
            const content = this.extractFormattedContent(element)
            if (!content?.trim()) return

            const message: Message = {
                messageId: this.generateContextAwareKey(`temp`, isUser ? 'user' : 'AI', content, index),
                sender: isUser ? 'user' : 'AI',
                content: content.trim(),
                position: index,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }

            messages.push(message)
        })

        return messages
    }

    protected extractFormattedContent(element: Element): string {
        // Clone element to avoid modifying the original DOM
        const cloned = element.cloneNode(true) as Element

        // Remove unwanted elements (buttons, icons, etc.)
        const unwantedSelectors = [
            'button',
            '[class*="action"]',
            '[class*="toolbar"]',
            '[class*="copy"]',
            'svg'
        ]

        unwantedSelectors.forEach(selector => {
            cloned.querySelectorAll(selector).forEach(el => el.remove())
        })

        // Get text content
        return cloned.textContent || ''
    }

    protected generateContextAwareKey(
        conversationId: string,
        sender: string,
        content: string,
        position: number
    ): string {
        const contentHash = this.hashContent(content)
        return `${conversationId}_${position}_${sender}_${contentHash}`
    }

    protected hashContent(content: string): string {
        let hash = 0
        for (let i = 0; i < content.length; i++) {
            const char = content.charCodeAt(i)
            hash = ((hash << 5) - hash) + char
            hash = hash & hash
        }
        return Math.abs(hash).toString(36)
    }
}
