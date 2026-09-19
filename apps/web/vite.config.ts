import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  envDir: '../../',
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    host: true,
    // Telegram Mini App'ni ngrok/tunnel orqali ochish uchun
    allowedHosts: true,
  },
});
