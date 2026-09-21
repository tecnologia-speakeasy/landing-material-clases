#!/usr/bin/env node
/**
 * Genera los recursos gráficos que sirve la web a partir de los originales de
 * diseño (`design/originales/`), que NO se despliegan.
 *
 *   npm run optimizar-imagenes
 *
 * Solo hay que volver a correrlo cuando diseño entregue un original nuevo; el
 * resultado (`public/img/` y los favicon) va versionado en git.
 */
import { mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const origen = join(raiz, 'design', 'originales');
const destinoImg = join(raiz, 'public', 'img');

mkdirSync(destinoImg, { recursive: true });

/**
 * Los nombres de los originales llevan espacios, acentos y paréntesis, y el
 * acento puede venir descompuesto (NFD) según el sistema que los exportó.
 * Se localizan por un fragmento normalizado en vez de por nombre exacto.
 */
const archivos = readdirSync(origen);

function original(fragmento) {
  const buscado = normalizar(fragmento);
  const encontrado = archivos.find((nombre) => normalizar(nombre).includes(buscado));
  if (!encontrado) {
    throw new Error(`No encuentro el original que contenga "${fragmento}" en design/originales/`);
  }
  return join(origen, encontrado);
}

function normalizar(texto) {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Fondos: WebP con calidad alta; son degradados y tramas, comprimen muy bien. */
const fondos = [
  ['material de clases - fondo desktop', 'fondo-materiales-desktop.webp'],
  ['material de clases - fondo movil', 'fondo-materiales-movil.webp'],
];

/** Logo de la barra superior: ya viene al tamaño del diseño, solo se recomprime. */
const logos = [['speak easy.png', 'logo-speakeasy-header.webp']];

for (const [fragmento, salida] of fondos) {
  const info = await sharp(original(fragmento))
    .webp({ quality: 82, effort: 6 })
    .toFile(join(destinoImg, salida));
  console.log(`img/${salida.padEnd(30)} ${info.width}x${info.height}  ${kb(info.size)}`);
}

for (const [fragmento, salida] of logos) {
  const info = await sharp(original(fragmento))
    .webp({ quality: 95, effort: 6, alphaQuality: 100 })
    .toFile(join(destinoImg, salida));
  console.log(`img/${salida.padEnd(30)} ${info.width}x${info.height}  ${kb(info.size)}`);
}

/**
 * Favicon: el original es de 4320x4320 con mucho margen transparente. Se recorta
 * el margen y se deja un 6 % de aire para que el icono llene la pestaña.
 */
const TRANSPARENTE = { r: 255, g: 255, b: 255, alpha: 0 };
const BLANCO = { r: 255, g: 255, b: 255, alpha: 1 };

const iconoBase = await sharp(original('favicon')).trim({ threshold: 1 }).toBuffer();

for (const [lado, salida, fondo] of [
  [32, 'favicon-32.png', TRANSPARENTE],
  [192, 'favicon-192.png', TRANSPARENTE],
  // iOS no respeta la transparencia en el icono de pantalla de inicio: la
  // rellena de negro. Por eso este va sobre blanco.
  [180, 'apple-touch-icon.png', BLANCO],
]) {
  const margen = Math.round(lado * 0.06);
  const info = await sharp(iconoBase)
    .resize(lado - margen * 2, lado - margen * 2, { fit: 'contain', background: TRANSPARENTE })
    .extend({ top: margen, bottom: margen, left: margen, right: margen, background: fondo })
    .flatten(fondo === BLANCO ? { background: BLANCO } : false)
    .png({ compressionLevel: 9 })
    .toFile(join(raiz, 'public', salida));
  console.log(`${salida.padEnd(34)} ${info.width}x${info.height}  ${kb(info.size)}`);
}

function kb(bytes) {
  return `${(bytes / 1024).toFixed(1)} kB`;
}
