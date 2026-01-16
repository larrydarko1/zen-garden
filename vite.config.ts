import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { configDefaults } from 'vitest/config'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'logo.svg', 'texture.jpg', '*.mp3'],
      manifest: {
        name: 'ZenGarden',
        short_name: 'ZenGarden',
        description: 'A meditation and mindfulness web app to help you find inner peace',
        theme_color: '#181a20',
        background_color: '#1a1a1a',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        icons: [
          {
            src: '/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        // Increase the maximum file size limit to cache larger audio files
        maximumFileSizeToCacheInBytes: 25 * 1024 * 1024, // 25 MB
        // Cache all static assets
        globPatterns: ['**/*.{js,css,html,ico,png,svg,jpg,gif,mp3}'],
        // Runtime caching for API requests
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /\/api\/meditations.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'meditations-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 7 // 1 week
              },
              cacheableResponse: {
                statuses: [0, 200]
              },
              networkTimeoutSeconds: 10
            }
          },
          {
            urlPattern: /\/api\/(gratitude|emotions|insights).*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'user-data-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 // 1 day
              },
              cacheableResponse: {
                statuses: [0, 200]
              },
              networkTimeoutSeconds: 5
            }
          },
          {
            urlPattern: /\/api\/(auth|account|settings).*/i,
            handler: 'NetworkOnly',
            options: {
              cacheName: 'auth-cache'
            }
          }
        ],
        navigateFallback: null, // Disable for SPA to avoid conflicts
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true
      },
      devOptions: {
        enabled: false // Enable this in development if you want to test the service worker
      }
    })
  ],
  server: {
    port: 3000,
    proxy: {
      '/api': 'http://localhost:3001'
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    exclude: [...configDefaults.exclude],
  },
})
