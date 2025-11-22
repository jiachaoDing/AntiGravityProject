import { BasePlatformAdapter } from '../core/base-adapter'
import type { ConversationInfo, Message } from '../types'

/**
 * Qwen Adapter for https://tongyi.aliyun.com/qianwen or https://qianwen.com
 * URL pattern: https://qianwen.com/chat/{conversationId} or https://tongyi.aliyun.com/qianwen...
 */
export class QwenAdapter extends BasePlatformAdapter {
    public platform = 'qwen'

    public isValidConversationUrl(url: string): boolean {
        return (url.includes('tongyi.aliyun.com/qianwen') || url.includes('qianwen.com')) && url.includes('/chat/')
    }

    public extractConversationInfo(url: string): ConversationInfo {
        // Match pattern: https://qianwen.com/chat/{id} or similar
        const match = url.match(/\/chat\/([a-zA-Z0-9_-]+)/)

        return {
            conversationId: match ? match[1] : null,
            isNewConversation: !match
        }
    }

    public extractMessages(): Message[] {
        const messages: Message[] = []

        // Find the scroll wrapper that contains messages
        const scrollWrapper = document.querySelector('.scrollWrapper-LOelOS')
        if (!scrollWrapper) return messages

        // Get all message items (questions and answers)
        const allMessages = scrollWrapper.querySelectorAll('.questionItem-MPmrIl, .answerItem-SsrVa_')

        allMessages.forEach((element, index) => {
            const isQuestion = element.classList.contains('questionItem-MPmrIl')

            // Extract content
            const content = this.extractFormattedContent(element)
            if (!content?.trim()) return

            const message: Message = {
                messageId: this.generateContextAwareKey(`temp`, isQuestion ? 'user' : 'AI', content, index),
                sender: isQuestion ? 'user' : 'AI',
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

        // Remove unwanted elements (buttons, icons, citations, etc.)
        const unwantedSelectors = [
            'button',
            '[class*="action"]',
            '[class*="toolbar"]',
            '[class*="copy"]',
            '[class*="icon"]',
            '[class*="cite"]',
            'svg',
            'img'
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
