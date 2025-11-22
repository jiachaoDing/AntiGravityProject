import Database from 'better-sqlite3'
import path from 'node:path'
import { app } from 'electron'
import fs from 'fs-extra'
import type { Conversation } from '../../preload/types'
import { tokenizerService } from './tokenizer'

export class DatabaseService {
  private db: Database.Database

  constructor() {
    const userDataPath = app.getPath('userData')
    const dbPath = path.join(userDataPath, 'history.db')

    // Ensure directory exists
    fs.ensureDirSync(userDataPath)

    this.db = new Database(dbPath)
    this.initSchema()
  }

  private initSchema() {
    // Enable WAL mode for better concurrency
    this.db.pragma('journal_mode = WAL');

    this.db.exec(`
      -- V2 Schema for Chat Memo integration
      CREATE TABLE IF NOT EXISTS conversations_v2 (
        id TEXT PRIMARY KEY,
        platform TEXT NOT NULL,
        title TEXT,
        url TEXT,
        created_at TEXT,
        updated_at TEXT,
        message_count INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS messages_v2 (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        sender TEXT NOT NULL,
        content TEXT,
        thinking TEXT,
        position INTEGER,
        created_at TEXT,
        updated_at TEXT,
        FOREIGN KEY(conversation_id) REFERENCES conversations_v2(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages_v2(conversation_id);
      CREATE INDEX IF NOT EXISTS idx_conversations_url ON conversations_v2(url);
      CREATE INDEX IF NOT EXISTS idx_conversations_platform ON conversations_v2(platform);

      -- FTS5 for full text search (Legacy)
      CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts_v2 USING fts5(content, thinking, content='messages_v2', content_rowid='rowid');

      -- New FTS5 Index for Vertical Search (Tokenized)
      -- content='messages_v2' means it's an external content table linked to messages_v2
      CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts_index USING fts5(
        tokens,
        content='messages_v2',
        content_rowid='rowid'
      );

      -- Triggers for FTS (Legacy)
      CREATE TRIGGER IF NOT EXISTS messages_ai_v2 AFTER INSERT ON messages_v2 BEGIN
        INSERT INTO messages_fts_v2(rowid, content, thinking) VALUES (new.rowid, new.content, new.thinking);
      END;
      CREATE TRIGGER IF NOT EXISTS messages_ad_v2 AFTER DELETE ON messages_v2 BEGIN
        INSERT INTO messages_fts_v2(messages_fts_v2, rowid, content, thinking) VALUES('delete', old.rowid, old.content, old.thinking);
      END;
      CREATE TRIGGER IF NOT EXISTS messages_au_v2 AFTER UPDATE ON messages_v2 BEGIN
        INSERT INTO messages_fts_v2(messages_fts_v2, rowid, content, thinking) VALUES('delete', old.rowid, old.content, old.thinking);
        INSERT INTO messages_fts_v2(rowid, content, thinking) VALUES (new.rowid, new.content, new.thinking);
      END;
    `)
  }

  // --- Conversation Management ---

  public saveConversation(conversation: Conversation) {
    const saveTx = this.db.transaction(() => {
      // Upsert conversation
      this.db.prepare(`
        INSERT INTO conversations_v2 (id, platform, title, url, created_at, updated_at, message_count)
        VALUES (@id, @platform, @title, @url, @createdAt, @updatedAt, @messageCount)
        ON CONFLICT(id) DO UPDATE SET
          title = @title,
          url = @url,
          updated_at = @updatedAt,
          message_count = @messageCount
      `).run({
        id: conversation.id,
        platform: conversation.platform,
        title: conversation.title,
        url: conversation.url,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
        messageCount: conversation.messages.length
      });

      // Upsert messages
      const insertMsg = this.db.prepare(`
        INSERT INTO messages_v2 (id, conversation_id, sender, content, thinking, position, created_at, updated_at)
        VALUES (@id, @conversationId, @sender, @content, @thinking, @position, @createdAt, @updatedAt)
        ON CONFLICT(id) DO UPDATE SET
          content = @content,
          thinking = @thinking,
          position = @position,
          updated_at = @updatedAt
      `);

      console.log(`Saving ${conversation.messages.length} messages for conversation ${conversation.id}`);

      for (const msg of conversation.messages) {
        const result = insertMsg.run({
          id: msg.messageId,
          conversationId: conversation.id,
          sender: msg.sender,
          content: msg.content,
          thinking: msg.thinking || '',
          position: msg.position,
          createdAt: msg.createdAt,
          updatedAt: msg.updatedAt
        });

        // Update FTS Index only for newly inserted rows
        // changes() returns the number of rows modified by the last statement
        // For INSERT OR UPDATE, if changes() > 0 after an insert, it means a new row was inserted
        if (result.changes > 0 && result.lastInsertRowid) {
          // This is a new insert, add to FTS index
          const tokens = tokenizerService.tokenize(msg.content);
          this.db.prepare(`INSERT INTO messages_fts_index (rowid, tokens) VALUES (?, ?)`).run(result.lastInsertRowid, tokens);
        }
        // For UPDATEs, we skip FTS updates because the content typically doesn't change
        // If content does change, we'd need to delete old and insert new, which is complex
        // For now, we rely on re-indexing for updates
      }
    });

    try {
      saveTx();
      console.log(`✅ Transaction committed for conversation ${conversation.id}`);
    } catch (error) {
      console.error(`❌ Transaction failed for conversation ${conversation.id}:`, error);
      throw error;
    }
    return { status: 'ok' };
  }

  public getConversation(id: string): Conversation | null {
    const conversation = this.db.prepare('SELECT * FROM conversations_v2 WHERE id = ?').get(id) as any;

    if (!conversation) return null;

    const messages = this.db.prepare('SELECT * FROM messages_v2 WHERE conversation_id = ? ORDER BY position ASC').all(id) as any[];
    console.log(`📖 Retrieved ${messages.length} messages for conversation ${id}`);


    return {
      id: conversation.id,
      platform: conversation.platform,
      title: conversation.title,
      url: conversation.url,
      createdAt: conversation.created_at,
      updatedAt: conversation.updated_at,
      messageCount: conversation.message_count,
      messages: messages.map(msg => ({
        messageId: msg.id,
        sender: msg.sender,
        content: msg.content,
        thinking: msg.thinking,
        position: msg.position,
        createdAt: msg.created_at,
        updatedAt: msg.updated_at
      }))
    };
  }

  public findByUrl(url: string): Conversation | null {
    const conversation = this.db.prepare('SELECT * FROM conversations_v2 WHERE url = ?').get(url) as any;
    if (!conversation) return null;
    return this.getConversation(conversation.id);
  }

  public deleteConversation(id: string) {
    this.db.prepare('DELETE FROM conversations_v2 WHERE id = ?').run(id);
    return { success: true };
  }

  public getConversationsByPlatform(platform: string, limit: number = 50) {
    return this.db.prepare('SELECT * FROM conversations_v2 WHERE platform = ? ORDER BY updated_at DESC LIMIT ?').all(platform, limit);
  }

  /**
   * Advanced Search with Tokenization and Filters
   */
  public advancedSearch(query: any) {
    // 1. Tokenize
    const tokens = tokenizerService.tokenize(query.keyword);
    if (!tokens) return [];

    // Support prefix search by adding wildcard (*) to each token
    // Changed from AND to OR for more flexible matching
    const matchQuery = tokens.split(' ')
      .map(t => `\"${t}\"*`)  // Add * for prefix matching
      .join(' OR ');  // Use OR instead of AND for partial matching

    // 2. Build SQL
    let sql = `
      SELECT 
        m.id, m.content, m.thinking, m.created_at, m.sender,
        c.platform, c.title, c.id as conversation_id
      FROM messages_fts_index fts 
      JOIN messages_v2 m ON m.rowid = fts.rowid
      JOIN conversations_v2 c ON m.conversation_id = c.id
      WHERE messages_fts_index MATCH @matchQuery
    `;

    const params: any = { matchQuery };

    // 3. Filters
    if (query.filters?.platform?.length) {
      // Safe parameter injection for array is hard in better-sqlite3 named params, use manual placeholders
      sql += ` AND c.platform IN (${query.filters.platform.map((p: string) => `'${p}'`).join(',')})`;
    }

    if (query.filters?.dateRange) {
      sql += ` AND m.created_at BETWEEN @start AND @end`;
      params.start = query.filters.dateRange.start;
      params.end = query.filters.dateRange.end;
    }

    if (query.filters?.sender) {
      sql += ` AND m.sender = @sender`;
      params.sender = query.filters.sender;
    }

    // 4. Pagination
    sql += ` ORDER BY m.created_at DESC LIMIT @limit OFFSET @offset`;
    params.limit = query.options?.limit || 20;
    params.offset = query.options?.offset || 0;

    try {
      const results = this.db.prepare(sql).all(params) as any[];

      // 5. Generate snippets manually
      const tokenList = tokens.split(' ');
      return results.map(row => {
        const snippet = this.generateSnippet(row.content, tokenList, 150);
        return { ...row, snippet };
      });
    } catch (error) {
      console.error('Search failed:', error);
      return [];
    }
  }

  /**
   * Generate a snippet with highlighted keywords
   */
  private generateSnippet(content: string, keywords: string[], maxLength: number = 150): string {
    if (!content) return '';

    // Find the first occurrence of any keyword
    let firstIndex = -1;
    let matchedKeyword = '';

    const lowerContent = content.toLowerCase();
    for (const keyword of keywords) {
      const index = lowerContent.indexOf(keyword.toLowerCase());
      if (index !== -1 && (firstIndex === -1 || index < firstIndex)) {
        firstIndex = index;
        matchedKeyword = keyword;
      }
    }

    if (firstIndex === -1) {
      // No match found, return beginning
      return content.substring(0, maxLength) + (content.length > maxLength ? '...' : '');
    }

    // Calculate snippet bounds
    const halfLength = Math.floor(maxLength / 2);
    let start = Math.max(0, firstIndex - halfLength);
    let end = Math.min(content.length, firstIndex + matchedKeyword.length + halfLength);

    // Adjust to avoid cutting words
    if (start > 0) {
      const spaceIndex = content.lastIndexOf(' ', start);
      if (spaceIndex > 0 && start - spaceIndex < 20) start = spaceIndex + 1;
    }

    if (end < content.length) {
      const spaceIndex = content.indexOf(' ', end);
      if (spaceIndex > 0 && spaceIndex - end < 20) end = spaceIndex;
    }

    let snippet = content.substring(start, end);

    // Highlight all keywords
    for (const keyword of keywords) {
      const regex = new RegExp(`(${keyword})`, 'gi');
      snippet = snippet.replace(regex, '<b class="text-yellow-500 font-bold bg-yellow-100 dark:bg-yellow-900/30 px-1 rounded">$1</b>');
    }

    // Add ellipsis
    if (start > 0) snippet = '...' + snippet;
    if (end < content.length) snippet = snippet + '...';

    return snippet;
  }

  // Legacy support (optional, can be removed if not used)
  public getRecentConversations(limit: number = 20) {
    return this.db.prepare('SELECT * FROM conversations_v2 ORDER BY updated_at DESC LIMIT ?').all(limit);
  }

  /**
   * Get storage statistics
   */
  public getStorageStats() {
    const conversationCount = this.db.prepare('SELECT COUNT(*) as count FROM conversations_v2').get() as { count: number }
    const messageCount = this.db.prepare('SELECT COUNT(*) as count FROM messages_v2').get() as { count: number }

    // Get database file size
    const dbPath = (this.db as any).name
    const stats = fs.statSync(dbPath)
    const sizeInBytes = stats.size
    const sizeInMB = (sizeInBytes / (1024 * 1024)).toFixed(2)

    return {
      conversationCount: conversationCount.count,
      messageCount: messageCount.count,
      sizeInBytes,
      sizeInMB
    }
  }

  /**
   * Export all conversations with messages
   */
  public exportConversations() {
    const conversations = this.db.prepare(
      'SELECT * FROM conversations_v2 ORDER BY updated_at DESC'
    ).all()

    const result = conversations.map((conv: any) => {
      const messages = this.db.prepare(
        'SELECT * FROM messages_v2 WHERE conversation_id = ? ORDER BY position'
      ).all(conv.id)

      return {
        ...conv,
        messages
      }
    })

    return result
  }

  /**
   * Clear all data
   */
  public clearAllData() {
    this.db.prepare('DELETE FROM messages_v2').run()
    this.db.prepare('DELETE FROM conversations_v2').run()
    return { success: true }
  }

  /**
   * Re-index all messages for FTS
   */
  public reindexMessages() {
    const messages = this.db.prepare('SELECT rowid, content FROM messages_v2').all() as { rowid: number, content: string }[];
    console.log(`Re-indexing ${messages.length} messages...`);

    const insertFts = this.db.prepare('INSERT OR REPLACE INTO messages_fts_index (rowid, tokens) VALUES (?, ?)');

    const runTransaction = this.db.transaction((msgs) => {
      for (const msg of msgs) {
        const tokens = tokenizerService.tokenize(msg.content);
        insertFts.run(msg.rowid, tokens);
      }
    });

    try {
      runTransaction(messages);
      console.log('✅ Re-indexing complete.');
      return { success: true, count: messages.length };
    } catch (error) {
      console.error('❌ Re-indexing failed:', error);
      throw error;
    }
  }
}

export const dbService = new DatabaseService()
