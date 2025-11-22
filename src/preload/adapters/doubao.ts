import { BasePlatformAdapter } from '../core/base-adapter';
import type { Message, ConversationInfo } from '../types';

export class DoubaoAdapter extends BasePlatformAdapter {
    public platform = 'doubao';

    /**
     * Validate if URL is a valid Doubao conversation URL
     */
    isValidConversationUrl(url: string): boolean {
        try {
            const urlObj = new URL(url);
            const hostname = urlObj.hostname;
            const pathname = urlObj.pathname;

            if (!hostname.includes('doubao.com')) {
                return false;
            }

            // Only process /chat/ with specific path
            // Exclude /chat or /chat/ without conversation ID
            // Exclude /chat/local path
            const validPatterns = [
                /^\/chat\/(?!local)[^/]+.*$/ // /chat/specific_path, excluding local
            ];

            return validPatterns.some(pattern => pattern.test(pathname));
        } catch (error) {
            console.error('DoubaoAdapter: URL validation failed:', error);
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
                pathWithoutLeadingSlash !== 'chat') {
                result.conversationId = pathWithoutLeadingSlash.replace(/\//g, '_');
            }

            return result;
        } catch (error) {
            console.error('DoubaoAdapter: Failed to parse URL:', error);
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

        // Check if message container with text content
        return element.classList.contains('container-PrUkKo') &&
            !!element.querySelector('[data-testid="message_text_content"]');
    }

    /**
     * Extract all messages from the page
     */
    extractMessages(): Message[] {
        const messages: Message[] = [];

        // Directly find all elements containing message_text_content
        const messageTextElements = document.querySelectorAll('[data-testid="message_text_content"]');
        const messageContainers: Element[] = [];

        messageTextElements.forEach(textElement => {
            const container = textElement.closest('.container-PrUkKo');
            if (container && !messageContainers.includes(container)) {
                messageContainers.push(container);
            }
        });

        if (messageContainers.length === 0) {
            return messages;
        }

        // Check if user is editing
        const existTextarea = messageContainers.find(element => this.isInEditMode(element as HTMLElement));
        if (existTextarea) {
            console.log('DoubaoAdapter: User is editing, skipping extraction');
            return [];
        }

        messageContainers.forEach((container, index) => {
            let content = '';
            let thinking = '';
            let sender: 'user' | 'AI' | '' = '';

            // Check if user message
            const sendMessage = container.querySelector('[data-testid="send_message"]');
            if (sendMessage) {
                sender = 'user';
                const userTextElement = sendMessage.querySelector('[data-testid="message_text_content"]');
                if (userTextElement) {
                    content = (userTextElement as HTMLElement).innerText.trim();
                }
            }

            // Check if AI message
            const receiveMessage = container.querySelector('[data-testid="receive_message"]');
            if (receiveMessage) {
                sender = 'AI';

                // Find thinking content (if exists in collapsed thinking block)
                const thinkingBlock = receiveMessage.querySelector('.think-quota-block-mdbox-jawSft');
                if (thinkingBlock) {
                    thinking = this.extractFormattedContent(thinkingBlock);
                }

                // Find AI response content
                const aiTextElement = receiveMessage.querySelector('[data-testid="message_text_content"]');
                if (aiTextElement) {
                    content = this.extractFormattedContent(aiTextElement);
                }
            }

            if (content && sender) {
                const messageId = this.generateMessageId(sender, content, index);

                messages.push({
                    messageId,
                    sender,
                    content,
                    thinking,
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
