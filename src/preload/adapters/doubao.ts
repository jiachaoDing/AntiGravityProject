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

        // 直接查找所有带有 message_text_content 的元素
        const messageTextElements = document.querySelectorAll('[data-testid="message_text_content"]');
        // 存放消息容器的数组
        const messageContainers: Element[] = [];

        // 遍历每个文本元素，向上查找所属的消息容器（避免重复）
        messageTextElements.forEach(textElement => {
            // 向上查找 class 包含 container-PvPoAn 的父容器
            const container = textElement.closest('[data-testid="message-block-container"]');
            // 如果找到并且未被加入过数组，则加入
            if (container && !messageContainers.includes(container)) {
                messageContainers.push(container);
            }
        });

        // 如果没有消息容器，则直接返回空数组
        if (messageContainers.length === 0) {
            return messages;
        }

        // 检查消息框内是否有正在编辑的文本输入，如果有则跳过提取，防止保存未完成或中间状态的内容
        const existTextarea = messageContainers.find(element => this.isInEditMode(element as HTMLElement));
        if (existTextarea) {
            console.log('DoubaoAdapter: User is editing, skipping extraction');
            return [];
        }

        // 遍历每一个消息容器，提取其中的消息内容
        messageContainers.forEach((container, index) => {
            let content = '';
            let thinking = '';
            let sender: 'user' | 'AI' | '' = '';

            // 检查是否为用户发送的消息（存在 send_message 区块）
            const sendMessage = container.querySelector('[data-testid="send_message"]');
            if (sendMessage) {
                sender = 'user';
                const userTextElement = sendMessage.querySelector('[data-testid="message_text_content"]');
                if (userTextElement) {
                    // 提取用户消息文本内容
                    content = (userTextElement as HTMLElement).innerText.trim();
                }
            }

            // 检查是否为 AI 回复的消息（存在 receive_message 区块）
            const receiveMessage = container.querySelector('[data-testid="receive_message"]');
            if (receiveMessage) {
                sender = 'AI';

                // 查找 AI 回复下的思考（如果有收起的思考块则提取）
                const thinkingBlock = receiveMessage.querySelector('.think-quota-block-mdbox-jawSft');
                if (thinkingBlock) {
                    thinking = this.extractFormattedContent(thinkingBlock);
                }

                // 查找 AI 回复的文本内容区块
                const aiTextElement = receiveMessage.querySelector('[data-testid="message_text_content"]');
                if (aiTextElement) {
                    // 提取 AI 消息文本内容（格式化处理）
                    content = this.extractFormattedContent(aiTextElement);
                }
            }

            // 如果提取到了内容且确定了发送者，则生成消息对象并推入数组
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

        // 返回提取到的所有消息
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
