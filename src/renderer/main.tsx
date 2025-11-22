// 这是一个用于初始化 React 应用程序的入口文件。
// 它负责将根组件渲染到 HTML 页面中。
import React from 'react' // 导入 React 库，用于构建用户界面
import ReactDOM from 'react-dom/client' // 导入 ReactDOM 客户端库，用于将 React 组件渲染到 DOM
import App from './App' // 导入应用程序的根组件 App
import './index.css' // 导入全局 CSS 样式文件

// 使用 ReactDOM.createRoot 方法创建一个 React 根。
// document.getElementById('root')! 查找 HTML 中 id 为 'root' 的元素，并断言它一定存在。
ReactDOM.createRoot(document.getElementById('root')!).render(
    // 使用 React.StrictMode 包装 App 组件，用于在开发模式下检测潜在问题。
    <React.StrictMode>
        <App /> {/* 渲染应用程序的根组件 */}
    </React.StrictMode>,
)
