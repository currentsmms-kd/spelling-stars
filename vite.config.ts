import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "apple-touch-icon.png", "mask-icon.svg"],
      manifest: {
        name: "SpellStars",
        short_name: "SpellStars",
        description: "Kids spelling practice PWA",
        theme_color: "#ffffff",
        icons: [
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/auth\/.*/i,
            handler: "NetworkOnly",
            options: {
              cacheName: "supabase-auth-cache",
            },
          },
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-api-cache",
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 5, // 5 minutes for API data
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
              networkTimeoutSeconds: 5,
            },
          },
          {
            // Private audio recordings with signed URLs - never cache
            urlPattern: ({ url }: { url: URL }) => {
              const isStorage =
                url.hostname.includes(".supabase.co") &&
                url.pathname.includes("/storage/");
              const isAudioRecordings =
                url.pathname.includes("/audio-recordings/");
              const hasSignedToken = url.searchParams.has("token");
              // Don't cache if it's audio-recordings bucket OR has a signed URL token
              return isStorage && (isAudioRecordings || hasSignedToken);
            },
            handler: "NetworkOnly",
            options: {
              cacheName: "private-audio-cache",
              // NetworkOnly ignores cache entirely
            },
          },
          {
            // Public static assets (word-audio prompt files) - cache with reduced TTL
            urlPattern:
              /^https:\/\/.*\.supabase\.co\/storage\/v1\/object\/public\/word-audio\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "public-audio-cache",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 2, // 2 days (reduced from 7)
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // Other Supabase storage - short cache with network priority
            urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-storage-fallback",
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 30, // 30 minutes
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
              networkTimeoutSeconds: 5,
            },
          },
          {
            urlPattern: /\/child\/.*/,
            handler: "NetworkFirst",
            options: {
              cacheName: "child-routes-cache",
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24, // 24 hours (reduced from 7 days)
              },
              networkTimeoutSeconds: 3,
              // Fallback to cache if network fails, but try network first
            },
          },
          {
            urlPattern: /\/parent\/.*/,
            handler: "NetworkFirst",
            options: {
              cacheName: "parent-routes-cache",
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60, // 1 hour for parent routes
              },
              networkTimeoutSeconds: 3,
            },
          },
        ],
        // Clean up caches on activation
        cleanupOutdatedCaches: true,
      },
      devOptions: {
        enabled: true,
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
