/**
 * Type definitions for Chat Capture System
 */

export interface Message {
    messageId: string;
    sender: 'user' | 'AI' | 'unknown';
    content: string;
    thinking?: string;
    position: number;
    createdAt: string;
    updatedAt: string;
}

export interface Conversation {
    id: string;
    platform: string;
    title: string;
    messages: Message[];
    url: string;
    createdAt: string;
    updatedAt: string;
    messageCount?: number;
}

export interface ConversationInfo {
    conversationId: string | null;
    isNewConversation: boolean;
}

export interface MessageChanges {
    added: Message[];
    modified: Message[];
    deleted: string[];
    merged: Message[];
}

export interface CacheEntry<T> {
    data: T;
    timestamp: number;
    expiresAt: number;
}

export interface SearchQuery {
    keyword: string;
    filters?: {
        platform?: string[];
        dateRange?: {
            start: string;
            end: string;
        };
        sender?: 'user' | 'AI';
    };
    options?: {
        limit: number;
        offset: number;
        highlight: boolean;
    };
}
