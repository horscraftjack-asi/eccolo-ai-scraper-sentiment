import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Tailwind v4 is wired in via its Vite plugin — no tailwind.config.js or
// postcss.config.js needed. Utility classes come straight from the
// `@import "tailwindcss";` line in src/index.css.
export default defineConfig({
  plugins: [react(), tailwindcss()],
});
