import { defineConfig, type PluginOption } from "vite"
import react from "@vitejs/plugin-react"
import { TanStackRouterVite } from "@tanstack/router-plugin/vite"
import { capsizeRadixPlugin } from "vite-plugin-capsize-radix"

// Font metrics for capsize
import spaceGrotesk from "@capsizecss/metrics/spaceGrotesk"
import inter from "@capsizecss/metrics/inter"
import jetBrainsMono from "@capsizecss/metrics/jetBrainsMono"
import arial from "@capsizecss/metrics/arial"

export default defineConfig({
  plugins: [
    TanStackRouterVite({
      routesDirectory: "./src/routes",
      generatedRouteTree: "./src/routeTree.gen.ts",
    }),
    react(),
    // Cast needed due to @types/node version mismatch between packages
    capsizeRadixPlugin({
      outputPath: `./public/fonts.css`,
      // Space Grotesk - bold geometric sans for headings
      headingFontStack: [spaceGrotesk, arial],
      // Inter - clean readable body text
      defaultFontStack: [inter, arial],
      // JetBrains Mono - excellent for code/session IDs
      codingFontStack: [jetBrainsMono, arial],
    }) as unknown as PluginOption,
  ],
})
