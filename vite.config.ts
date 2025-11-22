import { defineConfig } from 'vite'
import path from 'node:path'
import electron from 'vite-plugin-electron/simple'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        react(),
        electron({
            main: {
                // Shortcut of `build.lib.entry`.
                entry: 'src/main/main.ts',
                vite: {
                    build: {
                        rollupOptions: {
                            external: ['better-sqlite3', 'segment'],
                        },
                    },
                },
            },
            preload: {
                // Shortcut of `build.rollupOptions.input`.
                // Preload scripts may contain Web assets, so use the `build.rollupOptions.input` instead `build.lib.entry`.
                input: {
                    index: path.join(__dirname, 'src/preload/index.ts'),
                    injector: path.join(__dirname, 'src/preload/injector.ts'),
                },
                vite: {
                    build: {
                        rollupOptions: {
                            external: ['electron'],
                            output: {
                                inlineDynamicImports: false,
                            },
                        },
                    },
                },
            },
            // Ployfill the Electron and Node.js API for Renderer process.
            // If you want use Node.js in Renderer process, the `nodeIntegration` needs to be enabled in the Main process.
            // See 👉 https://github.com/electron-vite/vite-plugin-electron-renderer
            renderer: {},
        }),
    ],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'src'),
        },
    },
})
