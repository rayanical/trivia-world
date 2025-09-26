import type { Config } from 'tailwindcss';

const config: Config = {
    content: ['./pages/**/*.{js,ts,jsx,tsx,mdx}', './components/**/*.{js,ts,jsx,tsx,mdx}', './app/**/*.{js,ts,jsx,tsx,mdx}'],
    theme: {
        extend: {
            colors: {
                primary: '#22c55e',
                secondary: '#15803d',
                background: '#052e16',
                'text-primary': '#ffffff',
                'text-secondary': '#a7f3d0',
                'border-color': '#166534',
            },
        },
    },
    plugins: [],
};
export default config;
