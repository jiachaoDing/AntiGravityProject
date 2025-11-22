import { BasePlatformAdapter } from '../core/base-adapter';
import type { Message, ConversationInfo } from '../types';

export class CopilotAdapter extends BasePlatformAdapter {
    public platform = 'copilot';

    /**
     * Validate if URL is a valid Copilot conversation
     */
    isValidConversationUrl(url: string): boolean {
        try {
            const urlObj = new URL(url);
            return urlObj.hostname.includes('copilot.microsoft.com');
        } catch {
            return false;
        }
    }

    /**
     * Extract conversation ID from URL
     */
    extractConversationInfo(url: string): ConversationInfo {
        const result: ConversationInfo = {
            conversationId: null,
            isNewConversation: false
        };

        try {
            const urlObj = new URL(url);
            const pathname = urlObj.pathname;

            // Copilot uses session-based IDs, extract from URL or generate
            const pathParts = pathname.split('/').filter(p => p);
            if (pathParts.length > 0) {
                result.conversationId = `copilot_${pathParts.join('_')}`;
            } else {
                result.conversationId = `copilot_${Date.now()}`;
                result.isNewConversation = true;
            }

            console.log(`✅ Extracted Copilot conversation ID: ${result.conversationId}`);
            return result;
        } catch (error) {
            console.error('❌ Failed to parse Copilot URL:', error);
            return result;
        }
    }

    /**
     * Check if node is a message element
     */
    isMessageElement(node: Node): boolean {
        if (node.nodeType !== Node.ELEMENT_NODE) return false;
        const element = node as Element;
        // Heuristic check for message elements
        return element.classList.toString().includes('message') ||
            element.classList.toString().includes('turn') ||
            element.hasAttribute('data-message-id');
    }

    /**
     * Extract all messages from the page
     * Conversation container: [data-content="conversation"]
     * User messages: [data-content="user-message"]
     * AI messages: [data-content="ai-message"]
     */
    extractMessages(): Message[] {
        const messages: Message[] = [];

        try {
            // Find conversation container
            const conversationContainer = document.querySelector('[data-content="conversation"]');
            if (!conversationContainer) {
                console.log('⚠️ Copilot conversation container not found');
                return messages;
            }

            // Check if user is editing (avoid capturing incomplete input)
            const existTextarea = conversationContainer.querySelector('textarea');
            if (existTextarea) {
                console.log('CopilotAdapter: User is editing, skipping extraction');
                return [];
            }

            // Extract all message elements in DOM order
            const userMessages = conversationContainer.querySelectorAll('[data-content="user-message"]');
            const aiMessages = conversationContainer.querySelectorAll('[data-content="ai-message"]');

            // Combine all messages and sort by their position in DOM
            const allMessageElements: Array<{ element: Element; sender: 'user' | 'AI' }> = [];

            userMessages.forEach(element => {
                allMessageElements.push({ element, sender: 'user' });
            });

            aiMessages.forEach(element => {
                allMessageElements.push({ element, sender: 'AI' });
            });

            // Sort by DOM position using compareDocumentPosition
            allMessageElements.sort((a, b) => {
                const position = a.element.compareDocumentPosition(b.element);
                if (position & Node.DOCUMENT_POSITION_FOLLOWING) {
                    return -1;
                }
                if (position & Node.DOCUMENT_POSITION_PRECEDING) {
                    return 1;
                }
                return 0;
            });

            console.log(`📝 Found ${userMessages.length} user messages and ${aiMessages.length} AI messages`);

            // Process messages in DOM order
            allMessageElements.forEach(({ element, sender }, index) => {
                const text = this.extractFormattedContent(element);
                if (!text) return;

                const messageId = this.generateMessageId(sender, text, index);
                messages.push({
                    messageId,
                    sender,
                    content: text,
                    thinking: '',
                    position: index,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                });
            });

            console.log(`✅ Copilot extracted ${messages.length} messages`);
        } catch (error) {
            console.error('❌ Failed to extract Copilot messages:', error);
        }

        return messages;
    }
}
