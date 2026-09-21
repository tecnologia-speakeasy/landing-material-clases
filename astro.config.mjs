// @ts-check
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  // Una sola página y ninguna ruta de API: se genera estática en el build.
  output: 'static',
  adapter: vercel(),
  vite: {
    plugins: [tailwindcss()],
  },
});
