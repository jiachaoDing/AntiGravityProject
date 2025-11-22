import { BasePlatformAdapter } from '../core/base-adapter';
import type { Message, ConversationInfo } from '../types';

export class YuanbaoAdapter extends BasePlatformAdapter {
    public platform = 'yuanbao';

    /**
     * Validate if URL is a valid Yuanbao conversation URL
     */
    isValidConversationUrl(url: string): boolean {
        try {
            const urlObj = new URL(url);
            const hostname = urlObj.hostname;
            const pathname = urlObj.pathname;

            // Check hostname
            if (!hostname.includes('yuanbao.tencent.com')) {
                return false;
            }

            const validPatterns = [
                /^\/chat\/[^/]+\/[^/]+$/ // /chat/app_id/conversation_id
            ];

            const isValid = validPatterns.some(pattern => pattern.test(pathname));
            return isValid;
        } catch (error) {
            console.error('YuanbaoAdapter: URL validation failed:', error);
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

            if (pathWithoutLeadingSlash) {
                result.conversationId = pathWithoutLeadingSlash.replace(/\//g, '_');
            } else {
                const conversationElement = document.querySelector('[data-conv-id]');
                if (conversationElement) {
                    const dataConvId = conversationElement.getAttribute('data-conv-id');
                    if (dataConvId) {
                        const idParts = dataConvId.split('_');
                        if (idParts.length > 0) {
                            result.conversationId = idParts[0];
                        }
                    }
                }
            }

            result.isNewConversation = !result.conversationId || result.conversationId === 'new';
            return result;
        } catch (error) {
            console.error('YuanbaoAdapter: Failed to parse URL:', error);
            return result;
        }
    }

    /**
     * Check if element is a message element
     */
    isMessageElement(node: Node): boolean {
        return (
            node.nodeType === Node.ELEMENT_NODE &&
            (node as Element).classList &&
            ((node as Element).classList.contains('agent-chat__list__item--human') ||
                (node as Element).classList.contains('agent-chat__list__item--ai'))
        );
    }

    /**
     * Extract all messages from the page
     */
    extractMessages(): Message[] {
        const messages: Message[] = [];

        const chatContainer = document.querySelector('.agent-chat__list__content');

        if (!chatContainer) {
            return messages;
        }

        const userMessages = chatContainer.querySelectorAll('.agent-chat__list__item--human');
        const aiMessages = chatContainer.querySelectorAll('.agent-chat__list__item--ai');

        const existTextarea = Array.from(userMessages).find(element => this.isInEditMode(element as HTMLElement));
        if (existTextarea) {
            console.log('YuanbaoAdapter: User is editing, skipping extraction');
            return [];
        }

        const allMessageElements: { element: Element, type: 'user' | 'ai' }[] = [];

        userMessages.forEach(element => {
            allMessageElements.push({ element, type: 'user' });
        });

        aiMessages.forEach(element => {
            allMessageElements.push({ element, type: 'ai' });
        });

        // Sort by DOM order
        allMessageElements.sort((a, b) => {
            const position = a.element.compareDocumentPosition(b.element);
            if (position & Node.DOCUMENT_POSITION_FOLLOWING) {
                return -1;
            } else if (position & Node.DOCUMENT_POSITION_PRECEDING) {
                return 1;
            }
            return 0;
        });

        allMessageElements.forEach((messageInfo, index) => {
            const { element, type } = messageInfo;
            let content = '';
            let thinking = '';

            if (type === 'user') {
                const contentElement = element.querySelector('.hyc-content-text');
                if (contentElement) {
                    content = (contentElement as HTMLElement).innerText.trim();
                }
            } else if (type === 'ai') {
                // Extract thinking content (if exists)
                const thinkingElement = element.querySelector('.hyc-component-reasoner__think-content');
                if (thinkingElement) {
                    thinking = (thinkingElement as HTMLElement).innerText.trim();

                    const reasonerTextElement = element.querySelector('.hyc-component-reasoner__text');
                    if (reasonerTextElement) {
                        content = this.extractFormattedContent(reasonerTextElement);
                    }
                } else {
                    const speechTextElement = element.querySelector('.agent-chat__speech-text');
                    if (speechTextElement) {
                        content = this.extractFormattedContent(speechTextElement);
                    }
                }

                // Fallback: extract content directly from AI message element
                if (!content) {
                    content = this.extractFormattedContent(element);
                }
            }

            if (content) {
                const messageId = this.generateMessageId(type === 'user' ? 'user' : 'AI', content, index);

                messages.push({
                    messageId,
                    sender: type === 'user' ? 'user' : 'AI',
                    content: content,
                    thinking: thinking,
                    position: index,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                });
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
