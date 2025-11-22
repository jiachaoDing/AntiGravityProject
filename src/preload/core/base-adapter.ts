/**
 * Base Platform Adapter
 * Abstract base class for all platform adapters
 * Provides common interface and utility methods
 */

import type { Message, ConversationInfo } from '../types';

export abstract class BasePlatformAdapter {
    public abstract platform: string;

    /**
     * Validate if URL is a valid conversation URL for this platform
     */
    abstract isValidConversationUrl(url: string): boolean;

    /**
     * Extract conversation ID and other info from URL
     */
    abstract extractConversationInfo(url: string): ConversationInfo;

    /**
     * Extract all messages from the page
     */
    abstract extractMessages(): Message[];

    /**
     * Helper: Generate a consistent message ID
     */
    protected generateMessageId(sender: string, content: string, position: number): string {
        return `msg_${sender}_position_${position}`;
    }

    /**
     * Helper: Extract clean text from an element
     */
    protected extractFormattedContent(element: Element): string {
        if (!element) return '';
        const text = element.textContent || '';
        return text.trim();
    }

    /**
     * Helper: Check if user is currently editing a message (to avoid capturing incomplete input)
     */
    protected isInEditMode(element: Element): boolean {
        return element.querySelector('textarea') !== null;
    }
}
