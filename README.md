# Landing de material de clases — Speak Easy

Página única y pública donde el estudiante descarga el PDF de cada clase del
lanzamiento. Sin registro, sin sesión y sin base de datos: se entra por el
enlace y se descarga.

El material de cada clase **se abre solo**, 2 horas después de que empiece la
clase. No hay que desplegar nada para habilitarlo.

- **Astro 7** renderizando en servidor (`output: 'server'`) desplegado en **Vercel**
- **Tailwind CSS 4**, diseño móvil primero
- El calendario de clases vive en `config/materiales.json`, versionado en git
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
3. El servidor compara la hora actual con la `fechaClase` de cada material:
   - **ya pasó la apertura** → botón rosa que enlaza al PDF, en una pestaña nueva;
   - **todavía no** → botón gris que no se puede pulsar, con la fecha de
     apertura en el `title` y para lectores de pantalla.
4. Quien deje la página abierta esperando la clase ve el botón abrirse solo: un
   guion de diez líneas recarga la página en el momento exacto de la apertura.

---

## El horario de apertura

Las seis clases del lanzamiento van **del 5 al 10 de octubre de 2026**, todos
los días a las **7:00 p. m. hora de Colombia**. El material de cada una se abre
a las **9:00 p. m.**, 2 horas después del inicio.

| Clase | Día | Empieza | Material disponible desde |
| --- | --- | --- | --- |
| 1 | lunes 5 de octubre | 7:00 p. m. | 9:00 p. m. |
| 2 | martes 6 de octubre | 7:00 p. m. | 9:00 p. m. |
| 3 | miércoles 7 de octubre | 7:00 p. m. | 9:00 p. m. |
| 4 | jueves 8 de octubre | 7:00 p. m. | 9:00 p. m. |
| 5 | viernes 9 de octubre | 7:00 p. m. | 9:00 p. m. |
| 6 | sábado 10 de octubre | 7:00 p. m. | 9:00 p. m. |

Una vez abierto, un material **no se vuelve a cerrar**: quien faltó a la clase
sigue pudiendo descargarlo.

El margen de 2 horas es la constante `MINUTOS_DESPUES` de
[`src/lib/materiales.ts`](src/lib/materiales.ts). Cambiarla mueve la apertura de
todas las clases a la vez.

### Por qué la página se renderiza en servidor

Un sitio estático se congelaría con el estado que tuviera el día del despliegue:
si se compila el 30 de septiembre, los seis botones quedan grises para siempre.
Además, el enlace al PDF estaría en el HTML desde el primer día y cualquiera
podría sacarlo del código fuente antes de tiempo.

Con `output: 'server'` la decisión se toma en cada visita y **el `href` del PDF
solo se escribe en el HTML cuando el material ya está abierto**.

Para que un lanzamiento con mucha gente a la vez no dispare una ejecución por
visita, la página se cachea en el CDN de Vercel exactamente hasta la siguiente
apertura (cabecera `Cache-Control: public, max-age=0, s-maxage=<segundos que
faltan>`, con un tope de una hora). El botón se abre a su hora exacta sin que el
servidor tenga que renderizar cada petición.

### Las horas se escriben con la diferencia horaria

`fechaClase` es ISO 8601 y **el offset es obligatorio**:

```
2026-10-05T19:00:00-05:00
```

Colombia es UTC−5 todo el año, sin horario de verano, así que `-05:00` es
siempre correcto. Escribir la fecha sin offset la dejaría a merced del reloj del
servidor que la renderice, que en Vercel está en UTC: las clases se abrirían
cinco horas antes de tiempo. Por eso el esquema rechaza las fechas sin offset en
vez de adivinar.

---

## Estructura del proyecto

```
config/materiales.json           Calendario: títulos, miniaturas, PDF y fecha de cada clase
scripts/optimizar-imagenes.mjs   Genera public/img y los favicon desde design/originales
design/originales/               Entregables de diseño sin optimizar
src/lib/materiales.ts            Carga, validación (zod) y lógica de apertura
src/layouts/Layout.astro         <head> común: favicon, precarga de fuente, fondo
src/styles/global.css            Fuente autoalojada, tokens del diseño y fondo
src/components/BannerLanzamiento.astro Banner del lanzamiento: botón de compra y cuenta atrás
src/components/TarjetaMaterial.astro Tarjeta de un material: miniatura, texto y botón
src/pages/index.astro            La única página
```

---

## Configurar los materiales

El calendario vive en [`config/materiales.json`](config/materiales.json). **No
es una variable de entorno**: es contenido (títulos, miniaturas, PDF, fechas),
no un secreto, así que se versiona en git y cada cambio se ve en el diff.

> Va en `config/` y no en la raíz a propósito. Un archivo suelto en la raíz hace
> que el servidor de desarrollo de Vite resuelva una URL del mismo nombre a ese
> archivo (le añade la extensión `.json` por su cuenta) y lo sirva en lugar de
> la página.

Es un array de objetos con estos campos:

| Campo | | Qué es |
| --- | --- | --- |
| `id` | obligatorio | Identificador interno, sin espacios. Solo letras, números y guiones. |
| `titulo` | obligatorio | Título visible de la tarjeta. |
| `miniaturaUrl` | obligatorio | Imagen de la clase (Blob de Vercel), URL completa. |
| `fechaClase` | obligatorio | Cuándo empieza la clase, ISO 8601 **con offset**: `2026-10-05T19:00:00-05:00`. El material se abre 2 horas después. |
| `descripcion` | opcional | Texto corto bajo el título. |
| `materialUrl` | opcional | PDF del material. Si falta, el botón sale bloqueado aunque ya sea la hora. |
| `disponible` | opcional | **Interruptor de emergencia que gana sobre el reloj.** `true` abre el material ya mismo; `false` lo cierra aunque ya haya pasado su hora. Si se omite —lo normal— manda el horario. |
| `textoBoton` | opcional | Por defecto `Descargar aquí`. El diseño alterna ese texto con `leer ahora` según la tarjeta. |

Los espacios en las URL del Blob van codificados como `%20`, tal cual los
devuelve el panel de Vercel.

Si el archivo tiene un campo mal puesto, la página no se rompe: muestra un aviso
y el detalle del error queda en los logs del servidor.

### Abrir o cerrar un material a mano

Si el día de la clase hay que adelantar o tapar un material sin esperar al
reloj, añade `disponible` a ese objeto y despliega:

```jsonc
{
  "id": "clase-3",
  "fechaClase": "2026-10-07T19:00:00-05:00",
  "disponible": true   // se abre ya, sin esperar a las 9:00 p. m.
}
```

Acuérdate de quitarlo después: mientras esté puesto, ese material deja de seguir
el horario.

---

## Diseño y recursos estáticos

El diseño sale de la sección **"Material de clase para YT"** de Figma (archivo
*CLASES-LANZAMIENTO*): el frame `Material de clases` (1920 px) y su variante
`Material de clases — Móvil 390`.

| Recurso | Dónde | Notas |
| --- | --- | --- |
| Fuente Inter | `public/fuentes/inter-latin*.woff2` | Subconjuntos latin y latin-ext. Es variable: un archivo cubre todos los pesos. Se precarga el subconjunto latin, que es el que cubre el español. |
| Fondo de la página | CDN de Kajabi | URL completas en `global.css`: una para móvil (390 px de ancho, en mosaico) y otra para desktop (960 × 1062). Los PNG antiguos de `design/originales/` y sus WebP de `public/img/` quedan sin usar. |
| Logo de la barra | `public/img/logo-speakeasy-header.webp` | Generado desde `design/originales/`. Sin usar desde que el banner del lanzamiento reemplazó la barra superior. |
| Favicon | `public/FAVICON.png`, `favicon-32.png`, `favicon-192.png`, `apple-touch-icon.png` | |
| Miniaturas y PDF | Blob de Vercel | Se configuran por material en `config/materiales.json`. |

Cuando diseño entregue un original nuevo, cópialo en `design/originales/` y
corre:

```bash
npm run optimizar-imagenes
```

Los colores y la tipografía del diseño están como tokens de Tailwind 4 en el
bloque `@theme` de [`src/styles/global.css`](src/styles/global.css) (`rosa`,
`morado-900`, `morado-600`, `texto`, `texto-fuerte`, `borde`,
`boton-inactivo`).

La página lleva `<meta name="robots" content="noindex">`: es material para los
estudiantes del lanzamiento, no una página que deba salir en Google.

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

Como la página se renderiza en servidor, **no hay que desplegar para que se
abra un material**: basta con que llegue su hora. Solo se despliega cuando
cambia `config/materiales.json` (títulos, PDF, fechas) o el código.

---

## Cómo probar

El calendario real está en octubre, así que para probar las aperturas conviene
mover las fechas a mano en `config/materiales.json` y recargar. Con
`npm run dev` levantado:

1. **Material ya abierto:** pon una `fechaClase` de ayer en la clase 1 → el
   botón sale rosa y abre el PDF en una pestaña nueva.
2. **Ya pasó la apertura:** pon una `fechaClase` de hace 2 horas y 10 minutos →
   el botón ya está abierto, porque la apertura fue hace 10 minutos.
3. **Clase en curso:** pon una `fechaClase` de hace 1 hora → el botón sigue
   gris, porque todavía falta 1 hora para la apertura. Pasa el ratón por encima y verás la hora exacta a la que se
   abre.
4. **El PDF no se filtra:** con el botón gris, busca `.pdf` en el código fuente
   de la página → no aparece. El `href` solo se escribe cuando el material está
   abierto.
5. **Se abre solo:** deja la página abierta con una apertura a un par de minutos
   vista → se recarga sola y el botón cambia a rosa sin tocar nada.
6. **Interruptor manual:** añade `"disponible": true` a una clase de octubre →
   se abre ya. Con `false` en una clase pasada → se cierra.
7. **Configuración rota:** escribe una `fechaClase` sin offset
   (`2026-10-05T19:00:00`) → la página muestra el aviso amarillo y el detalle
   sale por consola.
