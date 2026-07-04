import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'boz-green': '#22c55e',
      },
    },
  },
  plugins: [],
};

export default config;
