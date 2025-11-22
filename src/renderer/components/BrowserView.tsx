import { useEffect, useRef, useState } from 'react'

// BrowserViewProps 接口定义了 BrowserView 组件的属性。
// url: 要加载到 webview 中的 URL。
// cardId: 用于标识此 webview 实例的唯一 ID，也用于持久化分区和作为平台标识符。
// injectorPath: 注入器脚本的文件路径，由父组件传递。
interface BrowserViewProps {
    url: string
    cardId: string
    injectorPath: string
}

/**
 * BrowserView 组件用于在 Electron 应用程序中嵌入一个 webview。
 * 它负责加载指定的 URL，注入预加载脚本，并处理来自 webview 的 IPC 消息，
 * 特别是聊天消息，以便将其保存到后端。
 */
export function BrowserView({ url, cardId, injectorPath }: BrowserViewProps) {
    // webviewRef 用于直接访问底层的 <webview> DOM 元素。
    const webviewRef = useRef<any>(null)
    // 加载状态：用于显示/隐藏加载动画
    const [isLoading, setIsLoading] = useState(true)

    // 规范化路径，特别是对于 Windows 系统，将反斜杠替换为正斜杠。
    const normalizedPath = injectorPath.replace(/\\/g, '/')

    // 第二个 useEffect 钩子用于设置和清理 webview 事件监听器。
    // 它会在 cardId 或 preloadPath 改变时重新运行。
    useEffect(() => {
        const webview = webviewRef.current
        if (!webview) return // 如果 webview 元素尚未可用，则提前返回。

        // handleMessage 函数处理来自 webview 预加载脚本的 IPC 消息。
        const handleMessage = (event: any) => {
            // 消息来自 injector.ts 通过 ipc-message 事件。
            console.log('Received IPC message:', event.channel, event.args)

            // 处理注入器加载成功的确认消息。
            if (event.channel === 'injector-loaded') {
                console.log('✅ Injector script loaded successfully in webview')
                return
            }

            // 只处理 'chat-message' 类型的事件。
            if (event.channel !== 'chat-message') {
                console.log('Ignoring non-chat-message:', event.channel)
                return
            }

            const messageData = event.args[0]
            // 验证消息数据的结构。
            if (!messageData || !messageData.role || !messageData.content) {
                console.error('Invalid message data:', messageData)
                return
            }

            try {
                console.log('Saving message:', messageData)
                // 调用 Electron API 保存聊天消息。
                window.electronAPI.saveMessage({
                    conversationId: -1, // -1 表示后端应查找或创建活跃会话。
                    platform: cardId, // 使用 cardId 作为平台标识符。
                    role: messageData.role,
                    content: messageData.content
                }).then(() => {
                    console.log('Message saved successfully')
                }).catch((err: any) => {
                    console.error('Error saving message:', err)
                })

            } catch (e) {
                console.error('Failed to save message', e)
            }
        }

        // handleNewWindow 函数处理 webview 中请求打开新窗口的事件（例如 OAuth 弹出窗口）。
        const handleNewWindow = (event: any) => {
            console.log('New window requested:', event.url)
            // webview 将在内部处理弹出窗口，无需额外操作。
        }

        // Add context menu to open DevTools
        const handleContextMenu = () => {
            webview.openDevTools()
        }

        // 处理 webview 开始加载
        const handleDidStartLoading = () => {
            setIsLoading(true)
        }

        // 处理 webview 停止加载
        const handleDidStopLoading = () => {
            setIsLoading(false)
        }

        // 添加事件监听器。
        webview.addEventListener('ipc-message', handleMessage)
        webview.addEventListener('new-window', handleNewWindow)
        webview.addEventListener('context-menu', handleContextMenu)
        webview.addEventListener('did-start-loading', handleDidStartLoading)
        webview.addEventListener('did-stop-loading', handleDidStopLoading)

        // 返回一个清理函数，在组件卸载或依赖项改变时移除事件监听器。
        return () => {
            webview.removeEventListener('ipc-message', handleMessage)
            webview.removeEventListener('new-window', handleNewWindow)
            webview.removeEventListener('context-menu', handleContextMenu)
            webview.removeEventListener('did-start-loading', handleDidStartLoading)
            webview.removeEventListener('did-stop-loading', handleDidStopLoading)
        }
    }, [cardId, injectorPath]) // 依赖数组确保在 cardId 或 injectorPath 改变时重新设置监听器。

    // 如果 injectorPath 尚未加载，则不渲染 webview。
    if (!injectorPath) return null

    // 渲染 <webview> 元素和加载动画。
    return (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <webview
                ref={webviewRef} // 将 ref 绑定到 webview 元素。
                src={url} // 设置 webview 加载的 URL。
                preload={`file://${normalizedPath}`} // 指定预加载脚本的路径。
                useragent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" // 设置User-Agent以避免被检测为嵌入环境
                style={{ // 设置 webview 的样式。
                    width: '100%',
                    height: '100%',
                    border: 'none'
                }}
                // partition 用于为每个 cardId 创建独立的持久化存储分区，
                // 确保不同卡片之间的数据（如 cookie、localStorage）是隔离的。
                partition={`persist:${cardId}`}
            />

            {/* 加载动画覆盖层 */}
            {isLoading && (
                <div className="absolute top-0 left-0 w-full h-full bg-surface-light dark:bg-gray-900 flex flex-col items-center justify-center z-[1000] transition-opacity duration-300">
                    {/* 简化版旋转环 */}
                    <div style={{ position: 'relative', width: '80px', height: '80px' }}>
                        <div style={{
                            position: 'absolute',
                            width: '100%',
                            height: '100%',
                            border: '3px solid transparent',
                            borderTopColor: '#3b82f6',
                            borderRightColor: '#8b5cf6',
                            borderRadius: '50%',
                            animation: 'spin 1.5s cubic-bezier(0.68, -0.55, 0.265, 1.55) infinite'
                        }} />
                        <div style={{
                            position: 'absolute',
                            width: '60%',
                            height: '60%',
                            top: '20%',
                            left: '20%',
                            border: '3px solid transparent',
                            borderBottomColor: '#06b6d4',
                            borderLeftColor: '#10b981',
                            borderRadius: '50%',
                            animation: 'spin-reverse 2s cubic-bezier(0.68, -0.55, 0.265, 1.55) infinite'
                        }} />
                    </div>

                    {/* 加载文字 */}
                    <div className="mt-6 font-sans text-sm font-semibold text-gray-500 dark:text-gray-400 tracking-[1.5px] opacity-80">
                        LOADING
                    </div>
                </div>
            )}
        </div>
    )
}
