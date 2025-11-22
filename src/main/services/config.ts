import { app } from 'electron'
import path from 'node:path'
import fs from 'fs-extra'

interface AppConfig {
    cards: {
        id: string
        name: string
        url: string
    }[]
    proxy: string
    autoSaveEnabled: boolean
    supportedPlatforms: string[]
}

const DEFAULT_CONFIG: AppConfig = {
    cards: [
        // Supported platforms (auto-save enabled)
        { id: 'chatgpt', name: 'ChatGPT', url: 'https://chat.openai.com' },
        { id: 'copilot', name: 'Copilot', url: 'https://copilot.microsoft.com' },
        { id: 'gemini', name: 'Gemini', url: 'https://gemini.google.com' },
        { id: 'yuanbao', name: 'Yuanbao', url: 'https://yuanbao.tencent.com' },
        { id: 'doubao', name: 'Doubao', url: 'https://www.doubao.com' },
        { id: 'deepseek', name: 'DeepSeek', url: 'https://chat.deepseek.com' },
        { id: 'kimi', name: 'Kimi', url: 'https://kimi.moonshot.cn' },
        { id: 'qwen', name: 'Qwen', url: 'https://tongyi.aliyun.com/qianwen' },

        // Other popular platforms (auto-save not yet supported)
        { id: 'anthropic', name: 'Claude', url: 'https://claude.ai' },
        { id: 'grok', name: 'Grok', url: 'https://grok.ai' },
        { id: 'yiyan', name: 'ERNIE', url: 'https://yiyan.baidu.com' },
        { id: 'xinghuo', name: 'Spark', url: 'https://xinghuo.xfyun.cn/desk' },
        { id: 'perplexity', name: 'Perplexity', url: 'https://www.perplexity.ai' },
        { id: 'poe', name: 'Poe', url: 'https://poe.com' },
        { id: 'lechat', name: 'Le Chat', url: 'https://chat.mistral.ai' },
        { id: 'huggingchat', name: 'HuggingChat', url: 'https://huggingface.co/chat' },
        { id: 'character', name: 'Character.AI', url: 'https://character.ai' },
    ],
    proxy: '',
    autoSaveEnabled: true,
    supportedPlatforms: ['chatgpt', 'copilot', 'gemini', 'yuanbao', 'doubao', 'deepseek', 'kimi', 'qwen']
}

export class ConfigService {
    private configPath: string
    private config: AppConfig

    constructor() {
        this.configPath = path.join(app.getPath('userData'), 'config.json')
        this.config = this.loadConfig()
    }

    private loadConfig(): AppConfig {
        try {
            if (fs.existsSync(this.configPath)) {
                return fs.readJsonSync(this.configPath)
            }
        } catch (e) {
            console.error('Failed to load config, using default', e)
        }
        return DEFAULT_CONFIG
    }

    public getConfig(): AppConfig {
        return this.config
    }

    public saveConfig(newConfig: AppConfig) {
        this.config = newConfig
        try {
            fs.writeJsonSync(this.configPath, newConfig, { spaces: 2 })
        } catch (e) {
            console.error('Failed to save config', e)
        }
    }
}

export const configService = new ConfigService()
