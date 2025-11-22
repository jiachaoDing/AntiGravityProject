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
     * Note: Copilot uses Shadow DOM, requires special handling
     */
    extractMessages(): Message[] {
        const messages: Message[] = [];

        try {
            // Try to find conversation container
            // Note: Selectors may need to be updated as Microsoft changes their UI
            const chatContainer = document.querySelector('[class*="conversation"]') ||
                document.querySelector('[class*="thread"]') ||
                document.querySelector('main') ||
                document.body;

            if (!chatContainer) {
                console.log('⚠️ Copilot conversation container not found');
                return messages;
            }

            // Find message elements
            // Note: These selectors are approximate and may need adjustment
            const messageElements = chatContainer.querySelectorAll('[class*="message"], [class*="turn"]');

            console.log(`📝 Found ${messageElements.length} potential message elements`);

            messageElements.forEach((element, index) => {
                const text = element.textContent?.trim();
                if (!text) return;

                // Determine if it's a user or AI message
                // This is heuristic-based and may need refinement
                const isUser = element.classList.toString().includes('user') ||
                    element.querySelector('[class*="user"]') !== null;

                const sender = isUser ? 'user' : 'AI';
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
