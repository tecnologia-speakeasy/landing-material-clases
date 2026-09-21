# Landing de material de clases — Speak Easy

Página única y pública donde el estudiante descarga el PDF de cada clase del
lanzamiento. Sin registro, sin sesión y sin base de datos: se entra por el
enlace y se descarga.

- **Astro 7** en modo estático (`output: 'static'`) desplegado en **Vercel**
- **Tailwind CSS 4**, diseño móvil primero
- El catálogo de materiales vive en `config/materiales.json`, versionado en git
- Miniaturas y PDF alojados en el **Blob de Vercel**

> Este repositorio nació copiando el portal de acceso a clases
> (`landing-auth-zoom`), que sí tenía login, PostgreSQL, inscripción en Zoom y
> padrón de GoHighLevel. Todo eso se eliminó: aquí no queda nada de ese backend
> ni variables de entorno que configurar.

---

## Cómo funciona

1. El estudiante abre `/` y ve la rejilla de materiales (una tarjeta por clase).
2. Cada tarjeta muestra la miniatura, el título, una línea de descripción y un
   botón.
3. El botón enlaza al PDF en el Blob de Vercel y lo abre en una pestaña nueva.
4. Si el material todavía no está abierto (`"disponible": false`) o no tiene
   `materialUrl`, la tarjeta se ve igual pero el botón sale en gris y no se
   puede pulsar.

No hay llamadas al servidor en tiempo de ejecución: la página se genera entera
en el build.

---

## Estructura del proyecto

```
config/materiales.json           Catálogo: títulos, miniaturas, PDF y bloqueo
scripts/optimizar-imagenes.mjs   Genera public/img y los favicon desde design/originales
design/originales/               Entregables de diseño sin optimizar (NO se despliegan)
src/lib/materiales.ts            Carga y validación de config/materiales.json (zod)
src/layouts/Layout.astro         <head> común: favicon, precarga de fuente, fondo
src/styles/global.css            Fuente autoalojada, tokens del diseño y fondo
src/components/BarraSuperior.astro   Barra superior (solo el logo)
src/components/TarjetaMaterial.astro Tarjeta de un material: miniatura, texto y botón
src/pages/index.astro            La única página
```

---

## Configurar los materiales

El catálogo vive en [`config/materiales.json`](config/materiales.json). **No es
una variable de entorno**: es contenido (títulos, miniaturas, PDF, qué material
está abierto), no un secreto, así que se versiona en git y cada cambio se ve en
el diff.

> Va en `config/` y no en la raíz a propósito. Un archivo suelto en la raíz hace
> que el servidor de desarrollo de Vite resuelva una URL del mismo nombre a ese
> archivo (le añade la extensión `.json` por su cuenta) y lo sirva en lugar de
> la página.

`src/lib/materiales.ts` lo importa como módulo, o sea que entra en el bundle.
Como contrapartida, **tocar el archivo exige un despliegue nuevo**.

Es un array de objetos con estos campos:

| Campo | | Qué es |
| --- | --- | --- |
| `id` | obligatorio | Identificador interno, sin espacios. Solo letras, números y guiones. |
| `titulo` | obligatorio | Título visible de la tarjeta. |
| `miniaturaUrl` | obligatorio | Imagen de la clase (Blob de Vercel), URL completa. |
| `descripcion` | opcional | Texto corto bajo el título. |
| `materialUrl` | opcional | PDF del material. Si falta, el botón sale bloqueado. |
| `disponible` | opcional | Por defecto `true`. En `false` la tarjeta se sigue viendo, con su miniatura y su texto, pero el botón sale en gris y no se puede pulsar. |
| `textoBoton` | opcional | Por defecto `Descargar aquí`. El diseño alterna ese texto con `leer ahora` según la tarjeta. |

Los espacios en las URL del Blob van codificados como `%20`, tal cual los
devuelve el panel de Vercel.

Si el archivo tiene un campo mal puesto, la página no se rompe: muestra un aviso
y el detalle del error queda en los logs del build.

---

## Diseño y recursos estáticos

El diseño sale de la sección **"Material de clase para YT"** de Figma (archivo
*CLASES-LANZAMIENTO*): el frame `Material de clases` (1920 px) y su variante
`Material de clases — Móvil 390`.

Todo lo que pinta el navegador está autoalojado, para que la primera carga no
dependa de ningún dominio externo:

| Recurso | Dónde | Notas |
| --- | --- | --- |
| Fuente Inter | `public/fuentes/inter-latin*.woff2` | Subconjuntos latin y latin-ext. Es variable: un archivo cubre todos los pesos. Se precarga el subconjunto latin, que es el que cubre el español. |
| Fondo y logo | `public/img/*.webp` | Generados desde `design/originales/`. |
| Favicon | `public/favicon-32.png`, `favicon-192.png`, `apple-touch-icon.png` | Recortados del `FAVICON.png` original, que trae mucho margen transparente. |
| Miniaturas y PDF | Blob de Vercel | Se configuran por material en `config/materiales.json`. |

Los originales de diseño viven en `design/originales/` y **no se despliegan**:
están fuera de `public/`. Cuando diseño entregue uno nuevo, cópialo ahí y corre:

```bash
npm run optimizar-imagenes
```

El resultado (`public/img/` y los favicon) va versionado en git, así que el
comando solo hace falta cuando cambia un original.

Los colores y la tipografía del diseño están como tokens de Tailwind 4 en el
bloque `@theme` de [`src/styles/global.css`](src/styles/global.css) (`rosa`,
`morado-900`, `morado-600`, `texto`, `texto-fuerte`, `borde`,
`boton-inactivo`).

La página lleva `<meta name="robots" content="noindex">`: es material para los
estudiantes del lanzamiento, no una página que deba salir en Google. Quítalo de
`src/layouts/Layout.astro` si en algún momento interesa indexarla.

---

## Puesta en marcha

Requisitos: Node.js 22.12 o superior. No hace falta ninguna credencial ni
archivo `.env`.

```bash
npm install
npm run dev        # http://localhost:4321
npm run build      # compilación de producción
npm run preview    # sirve el build
npm run check      # errores de tipos
```

---

## Despliegue en Vercel

Conecta el repositorio en Vercel. El adapter `@astrojs/vercel` ya está
configurado; no hace falta tocar los ajustes de build ni cargar variables de
entorno.

Cada cambio en `config/materiales.json` necesita un despliegue nuevo para verse
en producción.

---

## Cómo probar

1. `npm run dev` y abre <http://localhost:4321>.
2. **Material abierto:** pulsa el botón rosa → se abre el PDF en una pestaña
   nueva.
3. **Material bloqueado:** pon `"disponible": false` en un material de
   `config/materiales.json` y recarga → esa tarjeta mantiene la miniatura y el
   texto, pero su botón sale en gris y no se puede pulsar.
4. **Sin PDF:** borra el `materialUrl` de un material → el botón también sale
   bloqueado.
5. **Móvil:** con el inspector a 390 px de ancho, las tarjetas pasan a una sola
   columna y el encabezado reduce el tamaño del título.
6. **Configuración rota:** cambia `miniaturaUrl` por un texto que no sea una URL
   → la página muestra el aviso amarillo en vez de la rejilla, y el detalle sale
   por consola.
