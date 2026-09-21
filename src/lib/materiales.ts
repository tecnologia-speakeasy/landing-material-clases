import { z } from 'zod';
import materialesJson from '../../config/materiales.json';

/**
 * El catálogo de materiales vive en `config/materiales.json`: es contenido
 * editable (títulos, miniaturas, PDF, qué material está abierto), no un
 * secreto, así que se versiona en git y cada cambio se revisa en el diff.
 *
 * Va en `config/` y no en la raíz a propósito: un archivo suelto en la raíz
 * hace que el servidor de desarrollo de Vite resuelva una URL del mismo nombre
 * a ese archivo (le añade `.json` por su cuenta) y lo sirva en lugar de la
 * página.
 *
 * Se importa como módulo, así que entra en el bundle y la página se puede
 * generar estática: no hay lectura de disco en tiempo de ejecución.
 */

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
   * `false` deja la tarjeta visible con el botón bloqueado, que es el estado
   * gris del diseño. Por defecto los materiales están abiertos.
   */
  disponible: z.boolean().default(true),
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

/** Un material está descargable solo si está abierto y tiene PDF configurado. */
export function estaDisponible(material: Material): boolean {
  return material.disponible && material.materialUrl !== undefined;
}
