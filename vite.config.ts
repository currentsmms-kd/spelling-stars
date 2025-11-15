import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cache version for invalidation - increment to force cache refresh
const CACHE_VERSION = "v1";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["vite.svg"],
      manifest: {
        name: "SpellStars",
        short_name: "SpellStars",
        description: "Kids spelling practice PWA",
        theme_color: "#ffffff",
        icons: [
          {
            src: "/vite.svg",
            sizes: "any",
            type: "image/svg+xml",
          },
        ],
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/auth\/.*/i,
            handler: "NetworkOnly",
            options: {
              cacheName: `supabase-auth-${CACHE_VERSION}`,
            },
          },
          {
            // RPC function calls - never cache, always network-only
            urlPattern: ({ url }: { url: URL }) => {
              return (
                url.hostname.includes(".supabase.co") &&
                url.pathname.includes("/rest/") &&
                url.pathname.includes("/rpc/")
              );
            },
            handler: "NetworkOnly",
            options: {
              cacheName: `supabase-rpc-${CACHE_VERSION}`,
            },
          },
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: `supabase-api-${CACHE_VERSION}`,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 3, // 3 minutes for API data (reduced from 5)
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
              const isPrivateAudioUrl =
                isStorage && (isAudioRecordings || hasSignedToken);
              return isPrivateAudioUrl;
            },
            handler: "NetworkOnly",
            options: {
              cacheName: `private-audio-${CACHE_VERSION}`,
              // NetworkOnly ignores cache entirely
            },
          },
          {
            // Public static assets (word-audio prompt files) - cache with reduced TTL
            urlPattern:
              /^https:\/\/.*\.supabase\.co\/storage\/v1\/object\/public\/word-audio\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: `public-audio-${CACHE_VERSION}`,
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
              cacheName: `supabase-storage-${CACHE_VERSION}`,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 15, // 15 minutes (reduced from 30)
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
              cacheName: `child-routes-${CACHE_VERSION}`,
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 12, // 12 hours (reduced from 24)
              },
              networkTimeoutSeconds: 3,
              // Fallback to cache if network fails, but try network first
            },
          },
          {
            urlPattern: /\/parent\/.*/,
            handler: "NetworkFirst",
            options: {
              cacheName: `parent-routes-${CACHE_VERSION}`,
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 30, // 30 minutes (reduced from 1 hour)
              },
              networkTimeoutSeconds: 3,
            },
          },
        ],
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
  server: {
    // Restrict CORS to prevent unauthorized access during development
    cors: {
      origin: false, // Disable CORS in development for security
    },
    strictPort: true,
  },
});
