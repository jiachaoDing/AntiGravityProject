/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                background: {
                    light: '#ffffff',
                    dark: '#0f172a', // slate-900
                },
                surface: {
                    light: '#f3f4f6', // gray-100
                    dark: '#1e293b', // slate-800
                },
                primary: {
                    DEFAULT: '#3b82f6', // blue-500
                    hover: '#2563eb', // blue-600
                }
            }
        },
    },
    plugins: [],
}
