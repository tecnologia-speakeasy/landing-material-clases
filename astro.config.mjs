// @ts-check
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  // SSR: el botón de cada material se abre a una hora concreta, así que la
  // página se renderiza por petición. Estática se congelaría con el estado que
  // tuviera el día del despliegue, y además el enlace al PDF quedaría a la
  // vista en el HTML desde el primer día.
  output: 'server',
  adapter: vercel(),
  vite: {
    plugins: [tailwindcss()],
  },
});
