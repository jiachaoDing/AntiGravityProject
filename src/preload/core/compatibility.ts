/**
 * Compatibility Handler - Unified time processing, data migration, and message change detection
 * Ported from Chat Memo browser extension to Electron
 */

import type { Message, Conversation, MessageChanges } from '../types';

/**
 * Time utility functions
 */
export const TimeUtils = {
    getMessageTime(message: Message | null): string {
        if (!message) return '';
        if (message.createdAt) return message.createdAt;
        return new Date().toISOString();
    },

    getConversationTime(conversation: Conversation | null): string {
        if (!conversation) return '';
        if (conversation.createdAt) return conversation.createdAt;
        return new Date().toISOString();
    },

    getLastMessageTime(conversation: Conversation): string {
        if (!conversation?.messages || conversation.messages.length === 0) {
            return this.getConversationTime(conversation);
        }
        const lastMessage = conversation.messages[conversation.messages.length - 1];
        return this.getMessageTime(lastMessage);
    },

    isValidTimeString(timeString: string): boolean {
        if (!timeString) return false;
        try {
            const date = new Date(timeString);
            return !isNaN(date.getTime());
        } catch {
            return false;
        }
    },

    normalizeTimeString(timeString: string): string {
        if (!this.isValidTimeString(timeString)) {
            return new Date().toISOString();
        }
        return new Date(timeString).toISOString();
    }
};

/**
 * Data utility functions
 */
export const DataUtils = {
    hashContent(str: string): string {
        let hash = 0;
        if (str.length === 0) return hash.toString(36);

        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }

        return Math.abs(hash).toString(36);
    },

    generateFallbackMessageId(message: Partial<Message>): string {
        const sender = message.sender || 'unknown';
        const content = message.content || '';
        const position = message.position || 0;
        const hash = this.hashContent(content.substring(0, 50));

        return `msg_${sender}_pos${position}_${hash}`;
    }
};

/**
 * Unified Compatibility Handler
 */
export class Compatibility {
    private version = 2;
    private messageCache = new Map<string, { data: any; timestamp: number }>();
    private hashCache = new Map<string, string>();
    private cacheExpiry = 5 * 60 * 1000; // 5 minutes
    private changeHistory: any[] = [];
    private maxHistorySize = 100;

    // ==================== Time Processing ====================

    getMessageTime(message: Message): string {
        return TimeUtils.getMessageTime(message);
    }

    getConversationTime(conversation: Conversation): string {
        return TimeUtils.getConversationTime(conversation);
    }

    getLastMessageTime(conversation: Conversation): string {
        return TimeUtils.getLastMessageTime(conversation);
    }

    isValidTimeString(timeString: string): boolean {
        return TimeUtils.isValidTimeString(timeString);
    }

    normalizeTimeString(timeString: string): string {
        return TimeUtils.normalizeTimeString(timeString);
    }

    // ==================== Message Normalization ====================

    normalizeMessage(message: Partial<Message>): Message {
        const now = new Date().toISOString();

        const normalized: Message = {
            messageId: message.messageId || DataUtils.generateFallbackMessageId(message),
            sender: message.sender || 'unknown',
            content: message.content || '',
            thinking: message.thinking,
            position: message.position || 0,
            createdAt: message.createdAt || now,
            updatedAt: message.updatedAt || message.createdAt || now
        };

        return normalized;
    }

    normalizeConversation(conversation: Partial<Conversation>): Conversation {
        const now = new Date().toISOString();

        const normalized: Conversation = {
            id: conversation.id || '',
            platform: conversation.platform || '',
            title: conversation.title || 'New Chat',
            url: conversation.url || '',
            messages: conversation.messages?.map(msg => this.normalizeMessage(msg)) || [],
            createdAt: conversation.createdAt || now,
            updatedAt: conversation.updatedAt || conversation.createdAt || now
        };

        return normalized;
    }

    // ==================== Message Change Detection ====================

    processMessageChanges(currentMessages: Message[], storedMessages: Message[]): MessageChanges {
        console.log('📊 Processing message changes', {
            currentCount: currentMessages.length,
            storedCount: storedMessages.length
        });

        const changes: MessageChanges = {
            added: [],
            modified: [],
            deleted: [],
            merged: []
        };

        const currentMap = new Map(currentMessages.map(msg => [msg.messageId, msg]));
        const storedMap = new Map(storedMessages.map(msg => [msg.messageId, msg]));

        // Detect new messages
        for (const [messageId, message] of currentMap) {
            if (!storedMap.has(messageId)) {
                changes.added.push(message);
            }
        }

        // Detect deleted messages
        for (const [messageId, message] of storedMap) {
            if (!currentMap.has(messageId)) {
                changes.deleted.push(messageId);
            }
        }

        // Detect modified messages
        for (const [messageId, currentMsg] of currentMap) {
            const storedMsg = storedMap.get(messageId);
            if (storedMsg && this.hasContentChanges(currentMsg, storedMsg)) {
                changes.modified.push(currentMsg);
            }
        }

        // Merge: Start with stored, add new, update modified, remove deleted
        const deletedSet = new Set(changes.deleted);
        changes.merged = storedMessages.filter(msg => !deletedSet.has(msg.messageId));

        // Update modified messages
        for (const modifiedMsg of changes.modified) {
            const index = changes.merged.findIndex(m => m.messageId === modifiedMsg.messageId);
            if (index !== -1) {
                changes.merged[index] = modifiedMsg;
            }
        }

        // Add new messages
        changes.merged.push(...changes.added);

        console.log('✅ Message changes analyzed', {
            new: changes.added.length,
            modified: changes.modified.length,
            deleted: changes.deleted.length,
            total: changes.merged.length
        });

        this.recordChanges(changes);
        return changes;
    }

    private hasContentChanges(currentMsg: Message, storedMsg: Message): boolean {
        if (currentMsg.content !== storedMsg.content) return true;
        if (currentMsg.thinking !== storedMsg.thinking) return true;
        return false;
    }

    private recordChanges(changes: MessageChanges, conversationId?: string): void {
        const changeRecord = {
            timestamp: new Date().toISOString(),
            conversationId,
            changes: {
                new: changes.added.length,
                updated: changes.modified.length,
                removed: changes.deleted.length
            }
        };

        this.changeHistory.push(changeRecord);

        if (this.changeHistory.length > this.maxHistorySize) {
            this.changeHistory.shift();
        }
    }

    // ==================== Cache Management ====================

    getCachedMessage(key: string): any | null {
        const cached = this.messageCache.get(key);
        if (!cached) return null;

        if (Date.now() - cached.timestamp > this.cacheExpiry) {
            this.messageCache.delete(key);
            return null;
        }

        return cached.data;
    }

    setCachedMessage(key: string, data: any): void {
        this.messageCache.set(key, {
            data,
            timestamp: Date.now()
        });
    }

    generateContentHash(content: string): string {
        if (this.hashCache.has(content)) {
            return this.hashCache.get(content)!;
        }

        const hash = DataUtils.hashContent(content);
        this.hashCache.set(content, hash);
        return hash;
    }

    clearCache(): void {
        this.messageCache.clear();
        this.hashCache.clear();
    }

    getCacheStats() {
        return {
            messageCacheSize: this.messageCache.size,
            hashCacheSize: this.hashCache.size,
            changeHistorySize: this.changeHistory.length
        };
    }
}

// Export singleton instance
export const compatibility = new Compatibility();
