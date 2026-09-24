/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Listen on all network addresses for mobile testing
    port: 5173,
  },
  test: {
    globals: true,
    environment: 'node',
  },
});
