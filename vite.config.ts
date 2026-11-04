import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    watch: {
      // Needed inside Docker on Windows/macOS, where native file events are not delivered.
      usePolling: process.env.VITE_USE_POLLING === 'true',
    },
  },
});
