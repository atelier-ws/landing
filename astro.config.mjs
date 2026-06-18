import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwind from "@astrojs/tailwind";

import cloudflare from "@astrojs/cloudflare";

export default defineConfig({
  integrations: [
    react(),
    tailwind({
      applyBaseStyles: false,
    }),
  ],

  output: "static",
  site: "https://atelier.ws",

  vite: {
    server: {
      watch: {
        usePolling: true,
        interval: 500,
        ignored: ["**/node_modules/**", "**/dist/**", "**/.astro/**", "**/.git/**"],
      },
    },
  },

  adapter: cloudflare()
});