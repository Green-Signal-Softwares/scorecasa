import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

// Testes do scorecasa rodam em ambiente node (sem DOM) — usamos
// react-dom/server para renderizar componentes puros e checar o markup.
// Manter assim evita puxar happy-dom/@testing-library, que pesariam o
// install só para um único bloco visual sem estado.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
    conditions: ["workspace"],
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
