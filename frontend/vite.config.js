import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5000,
    // proxy: {
    //   "/api": {
    //     target: "https://chat-n9i7wuruo-rabnawazs-projects.vercel.app ",
    //     changeOrigin: true,
    //   },
    // },
  },
});
