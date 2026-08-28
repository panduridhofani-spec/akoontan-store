import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Dihe Mart',
        short_name: 'DiheMart',
        description: 'Aplikasi Rekap Transaksi Dihe Mart',
        theme_color: '#4f46e5',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: '/favicon.jpg',
            sizes: '192x192',
            type: 'image/jpeg'
          },
          {
            src: '/favicon.jpg',
            sizes: '512x512',
            type: 'image/jpeg'
          }
        ]
      }
    })
  ],
})
