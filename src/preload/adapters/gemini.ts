import { BasePlatformAdapter } from '../core/base-adapter';
import type { Message, ConversationInfo } from '../types';

export class GeminiAdapter extends BasePlatformAdapter {
    public platform = 'gemini';

    /**
     * Validate if URL is a valid Gemini conversation URL
     */
    isValidConversationUrl(url: string): boolean {
        try {
            const urlObj = new URL(url);
            const hostname = urlObj.hostname;
            const pathname = urlObj.pathname;

            if (!hostname.includes('gemini.google.com')) {
                return false;
            }

            // Support multiple URL formats
            const validPatterns = [
                /^\/gem\/[^/]+\/[^/]+$/, // /gem/*/conversation_id
                /^\/app\/[^/]+$/, // /app/conversation_id
                /^\/[^/]+\/[^/]+\/app\/[^/]+$/, // /*/*/app/conversation_id
                /^\/[^/]+\/[^/]+\/gem\/[^/]+\/[^/]+$/ // /*/*/gem/*/conversation_id
            ];

            // Exclude initial empty pages
            if (pathname === '/app' ||
                /^\/gem\/[^/]+$/.test(pathname) ||
                /^\/[^/]+\/[^/]+\/app$/.test(pathname) ||
                /^\/[^/]+\/[^/]+\/gem\/[^/]+$/.test(pathname)) {
                return false;
            }

            return validPatterns.some(pattern => pattern.test(pathname));
        } catch (error) {
            console.error('GeminiAdapter: URL validation failed:', error);
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

            // Remove leading slash
            const pathWithoutLeadingSlash = pathname.startsWith('/') ? pathname.substring(1) : pathname;

            // Parse path segments
            const pathSegments = pathWithoutLeadingSlash.split('/');

            let conversationId: string | null = null;

            if (pathSegments.length >= 2) {
                if (pathSegments[0] === 'app' && pathSegments[1]) {
                    conversationId = pathSegments[1];
                }
                else if (pathSegments[0] === 'gem' && pathSegments.length >= 3 && pathSegments[2]) {
                    conversationId = pathSegments[2];
                }
                else if (pathSegments.length >= 4 && pathSegments[2] === 'app' && pathSegments[3]) {
                    conversationId = pathSegments[3];
                }
                else if (pathSegments.length >= 5 && pathSegments[2] === 'gem' && pathSegments[4]) {
                    conversationId = pathSegments[4];
                }
            }

            if (conversationId) {
                // Use full path as conversation ID, replacing slashes with underscores
                result.conversationId = pathWithoutLeadingSlash.replace(/\//g, '_');
            }

            return result;
        } catch (error) {
            console.error('GeminiAdapter: Failed to parse URL:', error);
            return result;
        }
    }

    /**
     * Check if element is a message element
     */
    isMessageElement(node: Node): boolean {
        if (node.nodeType !== Node.ELEMENT_NODE || !(node as Element).classList) {
            return false;
        }

        const element = node as Element;

        if (element.classList.contains('conversation-container')) {
            return true;
        }

        if (element.tagName === 'USER-QUERY' || element.tagName === 'MODEL-RESPONSE') {
            return true;
        }

        // Check if contains message content elements
        if (element.querySelector('user-query') ||
            element.querySelector('model-response') ||
            element.querySelector('.query-text') ||
            element.querySelector('message-content')) {
            return true;
        }

        // Check if parent is message container
        let parent = element.parentElement;
        while (parent && parent !== document.body) {
            if (parent.classList.contains('conversation-container') ||
                parent.tagName === 'USER-QUERY' ||
                parent.tagName === 'MODEL-RESPONSE') {
                return true;
            }
            parent = parent.parentElement;
        }

        return false;
    }

    /**
     * Extract all messages from the page
     */
    extractMessages(): Message[] {
        const messages: Message[] = [];

        const chatHistoryContainer = document.querySelector('#chat-history');
        if (!chatHistoryContainer) {
            return messages;
        }

        const conversationBlocks = chatHistoryContainer.querySelectorAll('.conversation-container');
        if (conversationBlocks.length === 0) {
            return messages;
        }

        // Check if user is editing
        const existTextarea = Array.from(conversationBlocks).find(block => this.isInEditMode(block as HTMLElement));
        if (existTextarea) {
            console.log('GeminiAdapter: User is editing, skipping extraction');
            return [];
        }

        conversationBlocks.forEach((block, blockIndex) => {
            // Extract user message
            const userQueryContainer = block.querySelector('user-query .query-text');
            if (userQueryContainer) {
                let userContent = '';

                userContent = this.extractFormattedContent(userQueryContainer);

                if (userContent && userContent.trim()) {
                    const position = blockIndex * 2; // User message at even position
                    const userMessageId = this.generateMessageId('user', userContent, position);

                    messages.push({
                        messageId: userMessageId,
                        sender: 'user',
                        content: userContent,
                        thinking: '',
                        position: position,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    });
                }
            }

            // Extract AI response
            const modelResponseEntity = block.querySelector('model-response');
            if (modelResponseEntity) {
                let aiContent = '';

                const messageContentContainer = modelResponseEntity.querySelector('.model-response-text');
                if (messageContentContainer) {
                    aiContent = this.extractFormattedContent(messageContentContainer);
                }

                if (aiContent && aiContent.trim()) {
                    const position = blockIndex * 2 + 1; // AI message at odd position
                    const aiMessageId = this.generateMessageId('AI', aiContent, position);

                    messages.push({
                        messageId: aiMessageId,
                        sender: 'AI',
                        content: aiContent,
                        thinking: '',
                        position: position,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    });
                }
            }
        });

        return messages;
    }

    /**
     * Extract formatted content
     */
    protected extractFormattedContent(element: Element): string {
        if (!element) return '';

        // Clone the element to avoid modifying the original DOM
        const clonedElement = element.cloneNode(true) as HTMLElement;

        // Remove citation markers and reference links
        const citationElements = clonedElement.querySelectorAll('.ds-markdown-cite, a[rel="noreferrer"], .citation, [class*="cite"]');
        citationElements.forEach(cite => cite.remove());

        const textContent = clonedElement.innerText || clonedElement.textContent || '';

        return textContent
            .split('\n')
            .map(line => line.trim())
            .filter((line, index, array) => {
                if (line) return true;
                const prevLine = array[index - 1];
                const nextLine = array[index + 1];
                return prevLine && nextLine && prevLine.trim() && nextLine.trim();
            })
            .join('\n')
            .trim();
    }
}
