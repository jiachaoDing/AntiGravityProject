/**
 * Storage Manager - Coordinator for conversation storage with smart incremental updates
 * Ported from Chat Memo browser extension to Electron
 * 
 * Key Features:
 * - Smart incremental updates with anchor-based lazy-load protection
 * - LRU cache management
 * -  Message deduplication
 * - Batch operations
 */

import type { Message, Conversation } from '../types';
import { ElectronStorageAdapter } from './storage-adapter';
import { Compatibility } from './compatibility';

/**
 * Cache Manager - Handles conversation caching with LRU eviction
 */
export class CacheManager<T = any> {
    private cache = new Map<string, { data: T; timestamp: number }>();
    private maxSize: number;
    private expiry: number;
    private cleanupInterval: NodeJS.Timeout | null = null;

    constructor(maxSize = 100, expiry = 5 * 60 * 1000) {
        this.maxSize = maxSize;
        this.expiry = expiry;
        this.startPeriodicCleanup();
    }

    get(key: string): T | null {
        const cached = this.cache.get(key);
        if (cached && Date.now() - cached.timestamp < this.expiry) {
            return cached.data;
        }
        return null;
    }

    set(key: string, data: T): void {
        this.cleanupExpired();
        this.enforceMaxSize();
        this.cache.set(key, { data, timestamp: Date.now() });
    }

    delete(key: string): void {
        this.cache.delete(key);
    }

    clear(): void {
        this.cache.clear();
    }

    private cleanupExpired(): void {
        const now = Date.now();
        const expiredKeys: string[] = [];

        for (const [key, cached] of this.cache.entries()) {
            if (now - cached.timestamp > this.expiry) {
                expiredKeys.push(key);
            }
        }

        expiredKeys.forEach(key => this.cache.delete(key));
    }

    private enforceMaxSize(): void {
        while (this.cache.size >= this.maxSize) {
            const oldestKey = this.cache.keys().next().value;
            if (oldestKey) {
                this.cache.delete(oldestKey);
            } else {
                break;
            }
        }
    }

    private startPeriodicCleanup(): void {
        this.cleanupInterval = setInterval(() => {
            this.cleanupExpired();
        }, 5 * 60 * 1000); // Every 5 minutes
    }

    destroy(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        this.clear();
    }

    getStats() {
        const now = Date.now();
        const expiredEntries = Array.from(this.cache.entries()).filter(
            ([, cached]) => now - cached.timestamp > this.expiry
        );

        return {
            totalEntries: this.cache.size,
            expiredEntries: expiredEntries.length,
            validEntries: this.cache.size - expiredEntries.length
        };
    }
}

/**
 * Anchor Detector - Handles lazy-load anchor matching
 */
export class AnchorDetector {
    /**
     * Find anchor in stored messages (optimized version)
     */
    findHeadAnchor(currentMessages: Message[], storedMessages: Message[]): {
        found: boolean;
        position?: number;
        size?: number;
        protectedCount?: number;
    } {
        if (!currentMessages.length || !storedMessages.length) {
            return { found: false };
        }

        // Pre-compute fingerprints to avoid repeated calculations
        const storedFingerprints = storedMessages.map(msg =>
            `${msg.sender}:${msg.content.substring(0, 100)}`
        );

        const anchorSize = Math.min(6, currentMessages.length);

        // Try different anchor sizes from large to small
        for (let size = anchorSize; size >= 1; size--) {
            const anchor = currentMessages.slice(0, size).map(msg =>
                `${msg.sender}:${msg.content.substring(0, 100)}`
            );

            const anchorString = anchor.join('|');

            for (let i = 0; i <= storedFingerprints.length - size; i++) {
                const storedString = storedFingerprints.slice(i, i + size).join('|');

                if (storedString === anchorString) {
                    console.log(`🎯 Anchor matched (size=${size}, position=${i})`);
                    return { found: true, position: i, size, protectedCount: i };
                }
            }
        }

        return { found: false };
    }

    /**
     * Correct message IDs when anchor is matched
     */
    correctMessageIds(currentMessages: Message[], anchorPosition: number): Message[] {
        console.log('🔧 Correcting message IDs to avoid duplicates');

        return currentMessages.map((message, index) => {
            const correctedPosition = anchorPosition + index;
            const correctedMessageId = `msg_${message.sender}_position_${correctedPosition}`;

            return {
                ...message,
                position: correctedPosition,
                messageId: correctedMessageId
            };
        });
    }
}

/**
 * Storage Manager - Main coordinator class
 */
export class StorageManager {
    private storageAdapter: ElectronStorageAdapter;
    private cacheManager: CacheManager<Conversation>;
    private compatibility: Compatibility;
    private anchorDetector: AnchorDetector;

    constructor() {
        this.storageAdapter = new ElectronStorageAdapter();
        this.cacheManager = new CacheManager<Conversation>();
        this.compatibility = new Compatibility();
        this.anchorDetector = new AnchorDetector();
    }

    /**
     * Get conversation with caching
     */
    async getConversation(conversationId: string): Promise<Conversation | null> {
        // Try cache first
        const cached = this.cacheManager.get(conversationId);
        if (cached) {
            console.log('💾 Retrieved conversation from cache:', conversationId);
            return cached;
        }

        // Fetch from storage
        console.log('🗄️ Fetching conversation from storage:', conversationId);
        const conversation = await this.storageAdapter.getConversation(conversationId);

        if (conversation) {
            this.cacheManager.set(conversationId, conversation);
        }

        return conversation;
    }

    /**
     * Smart incremental update with lazy-load awareness
     */
    async smartIncrementalUpdate(
        conversationId: string,
        currentMessages: Message[],
        platform?: string
    ): Promise<{ success: boolean; conversation: Conversation; anchor?: boolean }> {
        if (!currentMessages || !Array.isArray(currentMessages)) {
            throw new Error('currentMessages must be a valid array');
        }

        const conversation = await this.getConversation(conversationId);
        const storedMessages = conversation?.messages || [];

        // New conversation or no stored messages: full save
        if (!storedMessages.length) {
            return this.saveNewConversation(conversationId, currentMessages, conversation, platform);
        }

        if (!currentMessages.length) {
            console.log('⏭️ No current messages, skip ping update');
            return { success: true, conversation: conversation! };
        }

        // Existing conversation: anchor matching
        const anchor = this.anchorDetector.findHeadAnchor(currentMessages, storedMessages);
        return this.processWithAnchor(conversation!, currentMessages, storedMessages, anchor);
    }

    /**
     * Process with anchor (partition-based update)
     */
    private async processWithAnchor(
        conversation: Conversation,
        currentMessages: Message[],
        storedMessages: Message[],
        anchor: ReturnType<AnchorDetector['findHeadAnchor']>
    ): Promise<{ success: boolean; conversation: Conversation; anchor?: boolean }> {
        let protectedZone: Message[] = [];
        let operationZone = storedMessages;
        let correctedCurrentMessages = currentMessages;

        if (anchor.found && anchor.position! > 0) {
            console.log(`🛡️ Protecting ${anchor.protectedCount} lazy-loaded messages`);
            protectedZone = storedMessages.slice(0, anchor.position);
            operationZone = storedMessages.slice(anchor.position);

            // Correct message IDs to avoid duplicates
            correctedCurrentMessages = this.anchorDetector.correctMessageIds(currentMessages, anchor.position!);
        } else if (!anchor.found) {
            console.log('⚠️ Anchor match failed, full overwrite with page content');
            // Full overwrite to ensure data consistency
            conversation.messages = currentMessages.map(msg => this.compatibility.normalizeMessage(msg));

            this.updateMetadata(conversation);
            await this.storageAdapter.saveConversation(conversation);
            this.cacheManager.set(conversation.id, conversation);

            console.log(`✅ Full overwrite complete, ${conversation.messages.length} messages`);
            return { success: true, conversation, anchor: false };
        }

        try {
            // Process changes in operation zone
            const changes = this.compatibility.processMessageChanges(correctedCurrentMessages, operationZone);

            const hasRealChanges = changes && (
                changes.added.length > 0 ||
                changes.modified.length > 0 ||
                changes.deleted.length > 0
            );

            if (!hasRealChanges) {
                console.log('⏭️ No message changes, skip save');
                return { success: true, conversation, anchor: anchor.found };
            }

            // Merge protected zone and updated operation zone
            conversation.messages = [...protectedZone, ...changes.merged];
            conversation.messages.sort((a, b) => (a.position || 0) - (b.position || 0));

            this.updateMetadata(conversation);
            await this.storageAdapter.saveConversation(conversation);
            this.cacheManager.set(conversation.id, conversation);

            console.log(`✅ Smart update complete, ${conversation.messages.length} messages`);
            return { success: true, conversation, anchor: anchor.found };
        } catch (error) {
            console.error('❌ Smart update failed:', error);
            throw error;
        }
    }

    /**
     * Save new conversation
     */
    private async saveNewConversation(
        conversationId: string,
        currentMessages: Message[],
        conversation: Conversation | null,
        platform?: string
    ): Promise<{ success: boolean; conversation: Conversation }> {
        console.log(`🆕 New conversation, saving ${currentMessages.length} messages`);

        if (!currentMessages.length) {
            return {
                success: true,
                conversation: conversation || {
                    id: conversationId,
                    platform: platform || '',
                    title: 'New Chat',
                    url: '',
                    messages: [],
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            };
        }

        const normalizedMessages = currentMessages.map(msg => this.compatibility.normalizeMessage(msg));

        const newConversation: Conversation = conversation || {
            id: conversationId,
            platform: platform || '',
            title: 'New Chat',
            url: '',
            messages: normalizedMessages,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        newConversation.messages = normalizedMessages;
        this.updateMetadata(newConversation);

        await this.storageAdapter.saveConversation(newConversation);
        this.cacheManager.set(conversationId, newConversation);

        return { success: true, conversation: newConversation };
    }

    /**
     * Update conversation metadata
     */
    private updateMetadata(conversation: Conversation): void {
        conversation.updatedAt = new Date().toISOString();

        // Generate title if not exists
        if (!conversation.title || conversation.title === 'New Chat') {
            const firstUserMessage = conversation.messages.find(m => m.sender === 'user');
            if (firstUserMessage) {
                const text = firstUserMessage.content;
                conversation.title = text.length > 50 ? text.substring(0, 50) + '...' : text;
            }
        }
    }

    /**
     * Clear cache
     */
    clearCache(conversationId?: string): void {
        if (conversationId) {
            this.cacheManager.delete(conversationId);
        } else {
            this.cacheManager.clear();
        }
    }

    /**
     * Get cache statistics
     */
    getCacheStats() {
        return this.cacheManager.getStats();
    }

    /**
     * Destroy instance and cleanup resources
     */
    destroy(): void {
        this.cacheManager.destroy();
        console.log('🧹 StorageManager destroyed');
    }
}

// Export singleton instance
export const storageManager = new StorageManager();
