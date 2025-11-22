import { Minus, Square, X, Moon, Sun } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'

export function TitleBar() {
    const { theme, toggleTheme } = useTheme()

    const handleMinimize = () => {
        window.electronAPI.minimizeWindow()
    }

    const handleMaximize = () => {
        window.electronAPI.maximizeWindow()
    }

    const handleClose = () => {
        window.electronAPI.closeWindow()
    }

    return (
        <div className="h-8 bg-surface-light dark:bg-surface-dark flex items-center justify-between select-none titlebar-drag-region border-b border-gray-200 dark:border-gray-800 transition-colors duration-200">
            <div className="flex items-center px-3 gap-2">
                <div className="w-3 h-3 rounded-full bg-gradient-to-br from-blue-400 to-blue-600"></div>
                <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Electron AI Browser</span>
            </div>

            <div className="flex items-center h-full titlebar-no-drag">
                {/* Theme Toggle */}
                <button
                    onClick={toggleTheme}
                    className="h-full px-3 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors flex items-center justify-center"
                    title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
                >
                    {theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
                </button>

                {/* Window Controls */}
                <button
                    onClick={handleMinimize}
                    className="h-full px-4 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors flex items-center justify-center"
                >
                    <Minus size={14} />
                </button>
                <button
                    onClick={handleMaximize}
                    className="h-full px-4 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors flex items-center justify-center"
                >
                    <Square size={12} />
                </button>
                <button
                    onClick={handleClose}
                    className="h-full px-4 hover:bg-red-500 hover:text-white text-gray-500 dark:text-gray-400 transition-colors flex items-center justify-center"
                >
                    <X size={14} />
                </button>
            </div>
        </div>
    )
}
