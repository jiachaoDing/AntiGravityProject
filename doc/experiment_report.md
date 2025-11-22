# 信息检索课程设计实验报告 - 基于 Electron 的 AI 聊天记录垂直搜索引擎

## 一、 实验背景与目的

随着大语言模型（LLM）的普及，用户在不同平台（如 ChatGPT, Copilot）积累了大量的对话数据。这些数据包含了宝贵的知识和信息，但分散在各个网页中，难以统一管理和检索。本实验旨在利用开源软件技术，构建一个**垂直搜索引擎**，实现对多平台 AI 聊天记录的自动化采集、存储、索引和深度检索。

## 二、 实验环境与工具

本实验采用以下开源技术栈构建：

*   **应用框架**: Electron (构建跨平台桌面应用)
*   **前端框架**: React + TypeScript
*   **数据库**: SQLite (本地嵌入式数据库)
*   **搜索引擎核心**: SQLite FTS5 Extension (全文检索引擎)
*   **中文分词**: `segment` (Node.js 分词库)

## 三、 实验内容与实现

### 1. 数据收集 (Data Collection) 

**目标**: 自动化获取 ChatGPT、Copilot 等不同平台的聊天记录。

**实现方案**:
为了应对不同 AI 平台 DOM 结构的差异，本项目采用了**面向对象的继承设计模式**。
*   **抽象基类 (`BasePlatformAdapter`)**: 定义了所有平台必须实现的通用接口（如 `extractMessages`, `isValidConversationUrl`）和公共辅助方法。
*   **具体适配器 (`ChatGPTAdapter`, `CopilotAdapter` 等)**: 继承自基类，针对特定平台的 DOM 结构实现具体的解析逻辑。
*   **工厂模式**: `Injector` 脚本根据当前 URL 自动实例化对应的适配器。

**关键代码 (`src/preload/core/base-adapter.ts`)**:
```typescript
// 抽象基类定义
export abstract class BasePlatformAdapter {
    public abstract platform: string;
    // 抽象方法：提取消息列表
    abstract extractMessages(): Message[];
    // 抽象方法：验证 URL
    abstract isValidConversationUrl(url: string): boolean;
    
    // 通用辅助方法：生成消息 ID
    protected generateMessageId(sender: string, content: string, position: number): string {
        return `msg_${sender}_position_${position}`;
    }
}
```

**关键代码 (`src/preload/adapters/chatgpt.ts`)**:
```typescript
// 具体实现类
export class ChatGPTAdapter extends BasePlatformAdapter {
    public platform = 'chatgpt';

    extractMessages(): Message[] {
        // 针对 ChatGPT 的 DOM 解析逻辑
        const userMessages = document.querySelectorAll('div[data-message-author-role="user"]');
        const aiMessages = document.querySelectorAll('div[data-message-author-role="assistant"]');
        // ... 解析并封装为 Message 对象 ...
        return messages;
    }
}
```

### 2. 文本预处理 (Text Preprocessing) 

**目标**: 对采集到的中文文本进行分词，以便建立倒排索引。

**实现方案**:
使用 Node.js 的 `segment` 库进行中文分词。为了提高搜索召回率，我们采用**搜索引擎模式**（即尽可能多地切分出词元）。

**关键代码 (`src/main/services/tokenizer.ts`)**:
```typescript
import { Segment } from 'segment';
const segment = new Segment();
segment.useDefault(); // 加载默认词典

export function tokenize(text: string): string {
  // 1. 去除 HTML 标签和特殊符号
  const cleanText = text.replace(/<[^>]+>/g, '').replace(/[^\w\u4e00-\u9fa5]/g, ' ');
  
  // 2. 执行分词
  const result = segment.doSegment(cleanText, {
    simple: true // 返回字符串数组
  });
  
  // 3. 去除停用词并连接
  return result.join(' ');
}
```
*例如*: 输入 "垂直搜索引擎"，分词结果为 "垂直 搜索 引擎 搜索引擎"。

### 3. 建立索引 (Indexing) 

**目标**: 基于分词结果构建倒排索引，支持快速全文检索。

**实现方案**:
利用 SQLite 内置的 **FTS5 (Full-Text Search 5)** 扩展模块。创建一个虚拟表 `messages_fts_index`，将分词后的 tokens 存入该表，并与原始数据表 `messages_v2` 关联。

**数据库 Schema**:
```sql
-- 原始数据表
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


-- FTS5 索引表 (外部内容表模式)
CREATE VIRTUAL TABLE messages_fts_index USING fts5(
    tokens,               -- 索引列：存储分词后的空格分隔字符串
    content='messages_v2', -- 关联原始表
    content_rowid='id'     -- 关联主键
);
```

**索引更新逻辑**:
每当有新消息插入 `messages_v2` 时，触发器或应用层代码会自动对 `content` 进行分词，并将结果插入 `messages_fts_index`。

### 4. 查询交互界面 (Query Interface) 

**目标**: 提供友好的用户界面，支持关键词搜索、结果高亮和条件过滤。

**实现方案**:
前端使用 React 构建 `SearchPage` 组件。
*   **搜索栏**: 用户输入关键词，支持实时防抖搜索。
*   **过滤器**: 支持按“平台”(ChatGPT/Copilot) 和 “发送者”(User/AI) 筛选。
*   **结果展示**: 使用 FTS5 的 `snippet` 函数或前端正则匹配，对搜索结果中的关键词进行**高亮显示**。

**关键代码 (`src/main/services/database.ts` - 搜索逻辑)**:
```typescript
public search(keyword: string) {
  const tokens = tokenize(keyword);
  // 构造 FTS5 查询语句，支持前缀匹配
  const matchQuery = tokens.split(' ').map(t => `"${t}"*`).join(' OR ');
  
  const sql = `
    SELECT m.*, snippet(messages_fts_index, 0, '<b>', '</b>', '...', 64) as highlight
    FROM messages_fts_index fts
    JOIN messages_v2 m ON m.rowid = fts.rowid
    WHERE messages_fts_index MATCH ?
    ORDER BY m.created_at DESC
  `;
  return this.db.prepare(sql).all(matchQuery);
}
```

## 四、 功能扩展 (Extended Features) 

在完成基本功能基础上，本项目进行了以下扩展：

1.  **多平台统一管理**: 不仅支持单一数据源，还统一了 ChatGPT、Copilot 等多个平台的接口，实现了跨平台搜索。
2.  **实时增量索引**: 实现了数据的实时流式处理，用户在聊天的同时，后台即时完成分词和索引更新，无需手动重建索引。
3.  **隐私保护**: 所有数据采集、处理和存储全流程在本地完成，不经过任何第三方服务器，确保了用户隐私数据的安全。

## 五、 实验总结

本实验成功构建了一个基于 Electron 的垂直搜索引擎。
1.  **数据采集**: 成功实现了对动态网页内容的实时捕获。
2.  **预处理与索引**: 通过 `segment` 分词和 SQLite FTS5，解决了中文搜索的准确性问题。
3.  **性能**: 在本地存储数万条聊天记录的情况下，搜索响应时间在毫秒级，体验流畅。

