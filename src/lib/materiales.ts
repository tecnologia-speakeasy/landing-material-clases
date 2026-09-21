import { z } from 'zod';
import materialesJson from '../../config/materiales.json';

/**
 * El catálogo de materiales vive en `config/materiales.json`: es contenido
 * editable (títulos, miniaturas, PDF, fecha de cada clase), no un secreto, así
 * que se versiona en git y cada cambio se revisa en el diff.
 *
 * Va en `config/` y no en la raíz a propósito: un archivo suelto en la raíz
 * hace que el servidor de desarrollo de Vite resuelva una URL del mismo nombre
 * a ese archivo (le añade `.json` por su cuenta) y lo sirva en lugar de la
 * página.
 *
 * Se importa como módulo, así que entra en el bundle: no hay lectura de disco
 * en tiempo de ejecución.
 */

/** El material se abre este rato ANTES de que empiece la clase. */
export const MINUTOS_ANTES = 30;

/** Trata la cadena vacía como "no configurado" para que aplique `.optional()`. */
const urlOpcional = z.preprocess(
  (valor) => (typeof valor === 'string' && valor.trim() === '' ? undefined : valor),
  z.url().optional(),
);

const esquemaMaterial = z.object({
  id: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/i, 'El id del material solo admite letras, números y guiones'),
  titulo: z.string().min(1),
  descripcion: z.string().optional(),
  /** Miniatura de la clase (Vercel Blob). Es obligatoria: la tarjeta gira en torno a ella. */
  miniaturaUrl: z.url('miniaturaUrl debe ser una URL completa (https://...)'),
  /**
   * PDF del material (Vercel Blob). Si falta, la tarjeta se ve igual pero con
   * el botón en gris: sirve para anunciar una clase cuyo material todavía no
   * está listo.
   */
  materialUrl: urlOpcional,
  /**
   * Cuándo empieza la clase, en ISO 8601 **con la diferencia horaria escrita**
   * (`-05:00` para Colombia, que no cambia de hora en todo el año). El offset
   * es obligatorio a propósito: sin él, la fecha se interpretaría según el
   * reloj del servidor que renderice, que en Vercel está en UTC.
   */
  fechaClase: z.iso.datetime({
    offset: true,
    message: 'fechaClase debe ser ISO 8601 con offset, por ejemplo 2026-10-05T19:00:00-05:00',
  }),
  /**
   * Interruptor manual que gana sobre el horario, para emergencias: `true`
   * abre el material aunque todavía no sea la hora y `false` lo cierra aunque
   * ya haya pasado. Si se omite, manda el reloj.
   */
  disponible: z.boolean().optional(),
  /** Texto del botón. El diseño alterna "Descargar aquí" y "leer ahora". */
  textoBoton: z.string().min(1).default('Descargar aquí'),
});

const esquemaMateriales = z
  .array(esquemaMaterial)
  .min(1, 'materiales.json debe tener al menos un material')
  .superRefine((materiales, ctx) => {
    const vistos = new Set<string>();
    for (const material of materiales) {
      if (vistos.has(material.id)) {
        ctx.addIssue({ code: 'custom', message: `id de material duplicado: ${material.id}` });
      }
      vistos.add(material.id);
    }
  });

export type Material = z.infer<typeof esquemaMaterial>;

let cache: readonly Material[] | null = null;

/** Valida `materiales.json`. Lanza si algún campo no cuadra. */
export function obtenerMateriales(): readonly Material[] {
  if (cache) return cache;

  const resultado = esquemaMateriales.safeParse(materialesJson);
  if (!resultado.success) {
    const detalle = resultado.error.issues
      .map((i) => `  - materiales[${i.path.join('.')}]: ${i.message}`)
      .join('\n');
    throw new Error(`materiales.json tiene un formato inválido:\n${detalle}`);
  }

  cache = Object.freeze(resultado.data);
  return cache;
}

/** Momento exacto en que el material se abre: la hora de la clase menos el margen. */
export function aperturaDe(material: Material): Date {
  return new Date(new Date(material.fechaClase).getTime() - MINUTOS_ANTES * 60_000);
}

/**
 * Un material es descargable si tiene PDF configurado y ya llegó su hora de
 * apertura. Una vez abierto **no se vuelve a cerrar**: el estudiante que faltó
 * a la clase sigue pudiendo descargar el material.
 *
 * `ahora` se pasa desde fuera para que todas las tarjetas de un mismo render
 * compartan el mismo instante y no puedan contradecirse entre sí.
 */
export function estaDisponible(material: Material, ahora: Date): boolean {
  if (material.materialUrl === undefined) return false;
  if (material.disponible !== undefined) return material.disponible;
  return ahora.getTime() >= aperturaDe(material).getTime();
}

/**
 * La siguiente apertura pendiente, o `null` si ya no queda ninguna. La usan dos
 * cosas: la cabecera `Cache-Control` de la página y el guion que recarga el
 * navegador justo cuando toca.
 *
 * Los materiales con interruptor manual no cuentan: su estado no depende del
 * reloj, así que no hay nada que esperar.
 */
export function proximaApertura(materiales: readonly Material[], ahora: Date): Date | null {
  const pendientes = materiales
    .filter((material) => material.materialUrl !== undefined && material.disponible === undefined)
    .map((material) => aperturaDe(material))
    .filter((apertura) => apertura.getTime() > ahora.getTime())
    .sort((a, b) => a.getTime() - b.getTime());

  return pendientes[0] ?? null;
}

/** "lunes 5 de octubre, 6:30 p. m." — para explicar cuándo se abre un material. */
export function formatearApertura(apertura: Date): string {
  return new Intl.DateTimeFormat('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Bogota',
  }).format(apertura);
}
