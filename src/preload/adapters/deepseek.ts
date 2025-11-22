import { BasePlatformAdapter } from '../core/base-adapter';
import type { Message, ConversationInfo } from '../types';

export class DeepSeekAdapter extends BasePlatformAdapter {
    public platform = 'deepseek';

    /**
     * Validate if URL is a valid DeepSeek conversation URL
     */
    isValidConversationUrl(url: string): boolean {
        try {
            const urlObj = new URL(url);
            const hostname = urlObj.hostname;
            const pathname = urlObj.pathname;

            if (!hostname.includes('chat.deepseek.com')) {
                return false;
            }

            const validPatterns = [
                /^\/a\/chat\/s\/[^/]+$/ // /a/chat/s/conversation_id
            ];

            return validPatterns.some(pattern => pattern.test(pathname));
        } catch (error) {
            console.error('DeepSeekAdapter: URL validation failed:', error);
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
                pathWithoutLeadingSlash !== 'a' &&
                pathWithoutLeadingSlash !== 'chat') {
                result.conversationId = pathWithoutLeadingSlash.replace(/\//g, '_');
            }

            return result;
        } catch (error) {
            console.error('DeepSeekAdapter: Failed to parse URL:', error);
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

        if (element.classList.contains('_9663006')) {
            return true;
        }

        if (element.classList.contains('_4f9bf79') && element.classList.contains('_43c05b5')) {
            return true;
        }

        // Check if contains AI message content elements
        if (element.querySelector('.ds-markdown-paragraph') ||
            element.querySelector('.e1675d8b') ||
            element.querySelector('[class*="markdown"]') ||
            element.querySelector('[class*="thinking"]')) {
            return true;
        }

        // Check if parent is message container
        let parent = element.parentElement;
        while (parent && parent !== document.body) {
            if (parent.classList.contains('_9663006') ||
                (parent.classList.contains('_4f9bf79') && parent.classList.contains('_43c05b5'))) {
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
        const seenContents = new Set<string>();

        const chatWindow = document.querySelector('.dad65929');
        if (!chatWindow) {
            return messages;
        }

        let messageElements = chatWindow.querySelectorAll('._9663006, ._4f9bf79._43c05b5');

        const existTextarea = Array.from(messageElements).find(element => this.isInEditMode(element as HTMLElement));
        if (existTextarea) {
            console.log('DeepSeekAdapter: User is editing, skipping extraction');
            return [];
        }

        // Fallback selector strategy
        if (messageElements.length === 0) {
            const alternativeSelectors = [
                '[class*="message"]',
                '[class*="chat"]',
                '.ds-markdown-paragraph',
                '.fbb737a4'
            ];

            for (const selector of alternativeSelectors) {
                const elements = chatWindow.querySelectorAll(selector);
                if (elements.length > 0) {
                    const messageContainers = new Set<Element>();
                    elements.forEach(el => {
                        let parent = el.parentElement;
                        while (parent && parent !== chatWindow) {
                            if (parent.classList.length > 0) {
                                messageContainers.add(parent);
                                break;
                            }
                            parent = parent.parentElement;
                        }
                    });

                    if (messageContainers.size > 0) {
                        messageElements = Array.from(messageContainers) as any;
                        break;
                    }
                }
            }
        }

        messageElements.forEach((element, index) => {
            const isUserMessage = (element as Element).classList.contains('_9663006');
            const sender: 'user' | 'AI' = isUserMessage ? 'user' : 'AI';
            let content = '';
            let thinking = '';

            if (isUserMessage) {
                const userTextElement = element.querySelector('.fbb737a4');
                if (userTextElement) {
                    content = (userTextElement as HTMLElement).innerText.trim();
                }
            } else {
                // Find AI thinking element
                let thinkingElement = element.querySelector('.e1675d8b');
                if (!thinkingElement) {
                    const potentialThinkingElements = element.querySelectorAll('div[class*="thinking"], div[class*="thought"], .thinking-content');
                    if (potentialThinkingElements.length > 0) {
                        thinkingElement = potentialThinkingElements[0];
                    }
                }
                if (thinkingElement) {
                    thinking = (thinkingElement as HTMLElement).innerText.trim();
                }

                // Find AI message text element
                const markdownContainer = element.querySelector('.ds-markdown, .ds-markdown--block');

                if (markdownContainer) {
                    content = this.extractFormattedContent(markdownContainer);
                } else {
                    const aiParagraphs = element.querySelectorAll('.ds-markdown-paragraph');

                    if (aiParagraphs.length > 0) {
                        content = Array.from(aiParagraphs)
                            .map(p => (p as HTMLElement).innerText.trim())
                            .filter(text => text)
                            .join('\n');
                    } else {
                        const alternativeSelectors = [
                            '.markdown-content',
                            '.message-content',
                            '.ai-response',
                            '[class*="markdown"]',
                            '[class*="content"]'
                        ];

                        for (const selector of alternativeSelectors) {
                            const contentElements = element.querySelectorAll(selector);
                            if (contentElements.length > 0) {
                                content = Array.from(contentElements)
                                    .map(el => this.extractFormattedContent(el))
                                    .filter(text => text)
                                    .join('\n');
                                if (content) break;
                            }
                        }

                        // Fallback: extract element text content directly
                        if (!content) {
                            const elementText = (element as HTMLElement).innerText.trim();
                            if (elementText) {
                                if (thinking && elementText.includes(thinking)) {
                                    content = elementText.replace(thinking, '').trim();
                                } else {
                                    content = elementText;
                                }
                            }
                        }
                    }
                }
            }

            if (content) {
                const contextKey = this.generateContextAwareKey(sender, content, index, messages);

                if (seenContents.has(contextKey)) {
                    return;
                }

                seenContents.add(contextKey);

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

    protected generateContextAwareKey(sender: 'user' | 'AI', content: string, _index: number, messages: Message[]): string {
        if (sender === 'user') {
            const previousAIMessage = messages.reverse().find(msg => msg.sender === 'AI');
            messages.reverse(); // Restore original order
            const context = previousAIMessage ? previousAIMessage.content.substring(0, 50) : '';
            return `${sender}:${content.substring(0, 100)}:ctx_${this.hashContent(context)}`;
        }

        if (sender === 'AI') {
            const previousUserMessage = messages.reverse().find(msg => msg.sender === 'user');
            messages.reverse(); // Restore original order
            const context = previousUserMessage ? previousUserMessage.content.substring(0, 50) : '';
            return `${sender}:${content.substring(0, 100)}:ctx_${this.hashContent(context)}`;
        }

        return `${sender}:${content.substring(0, 100)}`;
    }

    protected hashContent(str: string): string {
        let hash = 0;
        if (str.length === 0) return hash.toString();

        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }

        return Math.abs(hash).toString(36);
    }

    /**
     * Extract formatted content
     */
    protected extractFormattedContent(element: Element): string {
        if (!element) return '';

        // Clone the element to avoid modifying the original DOM
        const clonedElement = element.cloneNode(true) as HTMLElement;

        // Remove citation markers and reference links
        const citationElements = clonedElement.querySelectorAll('.ds-markdown-cite, a[rel="noreferrer"]');
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
