import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
	plugins: [
		react(),
		VitePWA({
			registerType: 'autoUpdate',

			// Assets to include in the service worker precache
			includeAssets: ['logo.svg'],

			// Web App Manifest — generated automatically by the plugin
			manifest: {
				name: 'SplitHome',
				short_name: 'SplitHome',
				description: 'Shared expense tracker for Ole & Yewleh',
				theme_color: '#2d4a3e',
				background_color: '#f5f3ef',
				display: 'standalone',
				orientation: 'portrait-primary',
				start_url: '/',
				scope: '/',
				icons: [
					{
						src: 'pwa-64x64.png',
						sizes: '64x64',
						type: 'image/png',
					},
					{
						src: 'pwa-192x192.png',
						sizes: '192x192',
						type: 'image/png',
					},
					{
						src: 'pwa-512x512.png',
						sizes: '512x512',
						type: 'image/png',
						purpose: 'any',
					},
					{
						src: 'maskable-icon-512x512.png',
						sizes: '512x512',
						type: 'image/png',
						purpose: 'maskable',
					},
				],
			},

			// Workbox config: network-first for API, cache-first for static assets
			workbox: {
				// Don't precache Supabase or external requests
				navigateFallback: '/index.html',
				runtimeCaching: [
					{
						// Supabase API — network only, never cache
						urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
						handler: 'NetworkOnly',
					},
					{
						// Google Fonts — cache-first
						urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
						handler: 'CacheFirst',
						options: {
							cacheName: 'google-fonts-cache',
							expiration: {
								maxEntries: 10,
								maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
							},
							cacheableResponse: { statuses: [0, 200] },
						},
					},
				],
			},
		}),
	],
})
