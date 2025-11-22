/**
 * Chat Capture Injector - Platform Router
 * Routes to appropriate platform adapter based on URL
 * Integrates with Chat Memo architecture
 */

import { ipcRenderer } from 'electron';
import { ChatGPTAdapter } from './adapters/chatgpt';
import { CopilotAdapter } from './adapters/copilot';
import { YuanbaoAdapter } from './adapters/yuanbao';
import { GeminiAdapter } from './adapters/gemini';
import { DoubaoAdapter } from './adapters/doubao';
import { DeepSeekAdapter } from './adapters/deepseek';
import { KimiAdapter } from './adapters/kimi';
import { QwenAdapter } from './adapters/qwen';
import { storageManager } from './core/storage-manager';
import type { Message } from './types';

console.log('🚀 Injector loaded');
ipcRenderer.sendToHost('injector-loaded');

/**
 * Platform router - determines which adapter to use
 */
class PlatformRouter {
    private adapter: ChatGPTAdapter | CopilotAdapter | YuanbaoAdapter | GeminiAdapter | DoubaoAdapter | DeepSeekAdapter | KimiAdapter | QwenAdapter | null = null;
    private conversationId: string | null = null;
    private debounceTimer: NodeJS.Timeout | null = null;
    private observer: MutationObserver | null = null;

    constructor() {
        this.initAdapter();
    }

    /**
     * Initialize the appropriate adapter based on URL
     */
    private initAdapter(): void {
        const url = window.location.href;
        const hostname = window.location.hostname;

        console.log(`🌐 Initializing adapter for: ${hostname}`);

        if (hostname.includes('chatgpt.com') || hostname.includes('chat.openai.com')) {
            this.adapter = new ChatGPTAdapter();
            console.log('✅ ChatGPT adapter initialized');
        } else if (hostname.includes('copilot.microsoft.com') || hostname.includes('bing.com')) {
            this.adapter = new CopilotAdapter();
            console.log('✅ Copilot adapter initialized');
        } else if (hostname.includes('yuanbao.tencent.com')) {
            this.adapter = new YuanbaoAdapter();
            console.log('✅ Yuanbao adapter initialized');
        } else if (hostname.includes('gemini.google.com')) {
            this.adapter = new GeminiAdapter();
            console.log('✅ Gemini adapter initialized');
        } else if (hostname.includes('doubao.com')) {
            this.adapter = new DoubaoAdapter();
            console.log('✅ Doubao adapter initialized');
        } else if (hostname.includes('deepseek.com') || hostname.includes('chat.deepseek.com')) {
            this.adapter = new DeepSeekAdapter();
            console.log('✅ DeepSeek adapter initialized');
        } else if (hostname.includes('kimi.moonshot.cn') || hostname.includes('kimi.com')) {
            this.adapter = new KimiAdapter();
            console.log('✅ Kimi adapter initialized');
        } else if (hostname.includes('tongyi.aliyun.com') || hostname.includes('qianwen.com')) {
            this.adapter = new QwenAdapter();
            console.log('✅ Qwen adapter initialized');
        } else {
            console.log('⚠️ No adapter available for this platform');
            return;
        }

        // Extract conversation ID only if URL is valid
        if (this.adapter.isValidConversationUrl(url)) {
            const info = this.adapter.extractConversationInfo(url);
            this.conversationId = info.conversationId;

            if (this.conversationId) {
                console.log(`📝 Conversation ID: ${this.conversationId}`);
                this.startObserving();
            } else {
                console.log('⚠️ No conversation ID found, waiting for navigation');
                this.watchForNavigation();
            }
        } else {
            console.log('⚠️ Not a valid conversation URL, waiting for navigation');
            this.watchForNavigation();
        }
    }

    /**
     * Watch for URL changes
     */
    private watchForNavigation(): void {
        let lastUrl = window.location.href;

        setInterval(() => {
            const currentUrl = window.location.href;
            if (currentUrl !== lastUrl) {
                lastUrl = currentUrl;
                console.log('🔄 URL changed, reinitializing adapter');
                this.stopObserving();
                this.initAdapter();
            }
        }, 1000);
    }

    /**
     * Start observing DOM changes
     */
    private startObserving(): void {
        if (!this.adapter) return;

        this.observer = new MutationObserver(() => {
            this.handleDOMChange();
        });

        this.observer.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true
        });

        console.log('👀 Started observing DOM changes');
    }

    /**
     * Stop observing
     */
    private stopObserving(): void {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
            console.log('🛑 Stopped observing');
        }
    }

    /**
     * Handle DOM changes with debouncing
     */
    private handleDOMChange(): void {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        // Debounce for 1 second to wait for streaming completion
        this.debounceTimer = setTimeout(() => {
            this.captureMessages();
        }, 1000);
    }

    /**
     * Capture messages from current page
     */
    private async captureMessages(): Promise<void> {
        if (!this.adapter || !this.conversationId) return;

        try {
            const messages = this.adapter.extractMessages();

            if (messages.length === 0) {
                console.log('📭 No messages extracted');
                return;
            }

            // Ensure message IDs are unique per conversation
            messages.forEach(msg => {
                if (!msg.messageId.startsWith(this.conversationId!)) {
                    msg.messageId = `${this.conversationId}_${msg.messageId}`;
                }
            });

            console.log(`📬 Extracted ${messages.length} messages`);

            // Use smart incremental update
            const result = await storageManager.smartIncrementalUpdate(
                this.conversationId,
                messages,
                this.adapter.platform
            );

            if (result.success) {
                console.log('✅ Messages saved successfully');

                // Notify host (optional)
                ipcRenderer.sendToHost('chat-updated', {
                    conversationId: this.conversationId,
                    messageCount: messages.length
                });
            }
        } catch (error) {
            console.error('❌ Failed to capture messages:', error);
        }
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new PlatformRouter();
    });
} else {
    new PlatformRouter();
}
