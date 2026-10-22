/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
// Set VITE_BASE=/<repo-name>/ for GitHub Pages project sites. Default './' works with hash routing anywhere.
export default defineConfig({
  base: process.env.VITE_BASE ?? './',
  plugins: [react()],
  test: { environment: 'jsdom', include: ['tests/**/*.test.{ts,tsx}'] },
});
