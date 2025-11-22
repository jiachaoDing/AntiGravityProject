/**
 * Electron Storage Adapter
 * Replaces Chrome Storage API with Electron IPC communication
 */

import { ipcRenderer } from 'electron';
import type { Conversation } from '../types';

export class ElectronStorageAdapter {
    /**
     * Get conversation by ID
     */
    async getConversation(conversationId: string): Promise<Conversation | null> {
        try {
            const response = await ipcRenderer.invoke('storage:get-conversation', conversationId);
            return response;
        } catch (error) {
            console.error('❌ ElectronStorageAdapter: Failed to get conversation:', error);
            return null;
        }
    }

    /**
     * Save or update conversation
     */
    async saveConversation(conversation: Conversation): Promise<{ success: boolean; error?: string }> {
        try {
            await ipcRenderer.invoke('storage:save-conversation', conversation);
            return { success: true };
        } catch (error) {
            console.error('❌ ElectronStorageAdapter: Failed to save conversation:', error);
            return { success: false, error: String(error) };
        }
    }

    /**
     * Find conversation by URL
     */
    async findConversationByUrl(url: string): Promise<Conversation | null> {
        try {
            const response = await ipcRenderer.invoke('storage:find-by-url', url);
            return response;
        } catch (error) {
            console.error('❌ ElectronStorageAdapter: Failed to find conversation by URL:', error);
            return null;
        }
    }

    /**
     * Delete conversation
     */
    async deleteConversation(conversationId: string): Promise<boolean> {
        try {
            await ipcRenderer.invoke('storage:delete-conversation', conversationId);
            return true;
        } catch (error) {
            console.error('❌ ElectronStorageAdapter: Failed to delete conversation:', error);
            return false;
        }
    }

    /**
     * Get all conversations for a platform
     */
    async getConversationsByPlatform(platform: string): Promise<Conversation[]> {
        try {
            const response = await ipcRenderer.invoke('storage:get-by-platform', platform);
            return response || [];
        } catch (error) {
            console.error('❌ ElectronStorageAdapter: Failed to get conversations by platform:', error);
            return [];
        }
    }
}

export const storageAdapter = new ElectronStorageAdapter();
