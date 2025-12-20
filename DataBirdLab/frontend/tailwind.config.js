/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                'databird-orange': '#F2994A',
                'databird-dark': '#111827', // Gray 900
                'databird-gray': '#1F2937', // Gray 800
                'sci-green': '#10B981', // Emerald 500
                'glass-bg': 'rgba(255, 255, 255, 0.05)',
                'glass-border': 'rgba(255, 255, 255, 0.1)',
                'glass-highlight': 'rgba(255, 255, 255, 0.1)',
            },
            fontFamily: {
                sans: ['"Noto Sans"', 'sans-serif'],
            },
            backdropBlur: {
                'xs': '2px',
            }
        },
    },
    plugins: [],
}
