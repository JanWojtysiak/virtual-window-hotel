import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    watch: {
      // Needed inside Docker on Windows/macOS, where native file events are not delivered.
      usePolling: process.env.VITE_USE_POLLING === 'true',
    },
  },
});
