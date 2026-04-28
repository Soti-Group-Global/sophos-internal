import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("@ckeditor")) return "vendor-ckeditor";
            if (id.includes("@fullcalendar")) return "vendor-calendar";
            if (id.includes("recharts")) return "vendor-charts";
            if (id.includes("framer-motion")) return "vendor-motion";
            if (id.includes("lucide-react")) return "vendor-lucide";
            if (id.includes("react-select")) return "vendor-react-select";
            if (id.includes("jspdf") || id.includes("html2pdf")) return "vendor-pdf";
            if (id.includes("moment") || id.includes("date-fns")) return "vendor-date";
            if (id.includes("axios") || id.includes("socket.io-client")) return "vendor-network";
            if (id.includes("lodash")) return "vendor-utils";
            if (id.includes("swiper")) return "vendor-swiper";
            return "vendor";
          }
        },
      },
    },
  },
});