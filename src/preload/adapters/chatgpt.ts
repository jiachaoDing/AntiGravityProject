import { BasePlatformAdapter } from '../core/base-adapter';
import type { Message, ConversationInfo } from '../types';

export class ChatGPTAdapter extends BasePlatformAdapter {
    public platform = 'chatgpt';

    /**
     * Validate if URL is a valid ChatGPT conversation
     */
    isValidConversationUrl(url: string): boolean {
        try {
            const urlObj = new URL(url);
            const hostname = urlObj.hostname;
            const pathname = urlObj.pathname;

            if (!hostname.includes('chatgpt.com') && !hostname.includes('chat.openai.com')) {
                return false;
            }

            const validPatterns = [
                /^\/c\/[^/]+$/, // /c/conversation_id
                /^\/g\/[^/]+\/c\/[^/]+$/ // /g/gpt_id/c/conversation_id
            ];

            return validPatterns.some(pattern => pattern.test(pathname));
        } catch (error) {
            console.error('❌ URL validation failed:', error);
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

            const pathWithoutLeadingSlash = pathname.startsWith('/') ? pathname.substring(1) : pathname;

            if (pathWithoutLeadingSlash &&
                pathWithoutLeadingSlash !== '' &&
                pathWithoutLeadingSlash !== 'c' &&
                pathWithoutLeadingSlash !== 'chat') {
                result.conversationId = pathWithoutLeadingSlash.replace(/\//g, '_');
                console.log(`✅ Extracted ChatGPT conversation ID: ${result.conversationId}`);
            }

            return result;
        } catch (error) {
            console.error('❌ Failed to parse URL:', error);
            return result;
        }
    }

    /**
     * Check if node is a message element
     */
    isMessageElement(node: Node): boolean {
        if (node.nodeType !== Node.ELEMENT_NODE) return false;
        const element = node as Element;

        return (
            (element.hasAttribute('data-testid') &&
                element.getAttribute('data-testid')?.startsWith('conversation-turn-')) ||
            element.hasAttribute('data-message-author-role')
        );
    }

    /**
     * Extract all messages from the page
     */
    extractMessages(): Message[] {
        const messages: Message[] = [];

        const conversationContainer = document.querySelector('main') ||
            document.querySelector('[role="main"]') ||
            document.body;

        if (!conversationContainer) {
            console.log('⚠️ Conversation container not found');
            return messages;
        }

        const articleContainers = conversationContainer.querySelectorAll('article');

        // Skip if user is editing
        const existTextarea = Array.from(articleContainers).find(element => this.isInEditMode(element));
        if (existTextarea) {
            console.log('✏️ User is editing, skip extraction');
            return [];
        }

        const userMessages = conversationContainer.querySelectorAll('div[data-message-author-role="user"]');
        const aiMessages = conversationContainer.querySelectorAll('div[data-message-author-role="assistant"]');

        console.log(`📝 Found ${userMessages.length} user messages, ${aiMessages.length} AI messages`);

        const allMessageElements: Array<{ element: Element; type: 'user' | 'ai'; position?: number }> = [];

        userMessages.forEach(element => {
            allMessageElements.push({ element, type: 'user' });
        });

        aiMessages.forEach(element => {
            allMessageElements.push({ element, type: 'ai' });
        });

        // Sort by DOM position
        allMessageElements.sort((a, b) => {
            const position = a.element.compareDocumentPosition(b.element);
            if (position & Node.DOCUMENT_POSITION_FOLLOWING) {
                return -1;
            } else if (position & Node.DOCUMENT_POSITION_PRECEDING) {
                return 1;
            }
            return 0;
        });

        // Assign positions
        allMessageElements.forEach((messageInfo, index) => {
            messageInfo.position = index;
        });

        // Extract content
        allMessageElements.forEach((messageInfo, index) => {
            const { element, type } = messageInfo;

            if (type === 'user') {
                const userTextElement = element.querySelector('.whitespace-pre-wrap');
                if (userTextElement && userTextElement.textContent?.trim()) {
                    const content = userTextElement.textContent.trim();
                    const messageId = this.generateMessageId('user', content, index);

                    messages.push({
                        messageId,
                        sender: 'user',
                        content,
                        thinking: '',
                        position: index,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    });
                }
            } else if (type === 'ai') {
                let thinking = '';
                let content = '';

                // Extract AI thinking text
                const potentialThinkingElements = element.querySelectorAll(':scope > div:not(.markdown)');
                potentialThinkingElements.forEach(ptElement => {
                    const htmlElement = ptElement as HTMLElement;
                    if (htmlElement.offsetParent !== null && htmlElement.innerText && htmlElement.innerText.trim() !== '') {
                        if (!htmlElement.querySelector('button') && !htmlElement.classList.contains('flex')) {
                            thinking = htmlElement.innerText.trim();
                        }
                    }
                });

                // Extract AI message text
                const aiMarkdownElement = element.querySelector('.markdown.prose');
                if (aiMarkdownElement) {
                    content = this.extractFormattedContent(aiMarkdownElement);
                }

                if (content) {
                    const messageId = this.generateMessageId('AI', content, index);

                    messages.push({
                        messageId,
                        sender: 'AI',
                        content,
                        thinking,
                        position: index,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    });
                }
            }
        });

        console.log(`✅ ChatGPT extracted ${messages.length} messages`);
        return messages;
    }
}
