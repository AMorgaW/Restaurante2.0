/**
 * Composiciones lado a lado: referencia (recorte del teléfono del video)
 * a la IZQUIERDA y captura de la aplicación a la DERECHA, ambas a la
 * misma altura sobre lienzo navy.
 *
 * Uso: npx tsx scripts/compose-side-by-side.ts <before|after>
 * Salida: artifacts/visual-comparison/<fase>/side-by-side/*.png
 */
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const PHASE = process.argv[2] ?? "before";
const REF = "references/analysis/keyframes/phone-crops";
const APP = path.join("artifacts/visual-comparison", PHASE, "screens");
const FRAMES = path.join("artifacts/visual-comparison", PHASE, "frames");
const OUT = path.join("artifacts/visual-comparison", PHASE, "side-by-side");

const HEIGHT = 844;
const GUTTER = 14;
const NAVY = { r: 2, g: 1, b: 24, alpha: 1 };

/** [salida, referencia, captura de la app] */
const PAIRS: Array<[string, string, string]> = [
  ["01-onboarding", `${REF}/t1-f33.png`, `${APP}/onboarding-390x844.png`],
  ["02-cta-inicial", `${REF}/t1-f12.png`, `${APP}/onboarding-390x844.png`],
  ["03-splash", `${REF}/t3-f05.png`, `${APP}/splash-mid-390x844.png`],
  ["04-home-entrada", `${REF}/t3-f25.png`, `${FRAMES}/flow1-homein-03.png`],
  ["05-home-estable", `${REF}/t4-f30.png`, `${APP}/home-390x844.png`],
  ["06-tarjeta-protagonista", `${REF}/t5-f08.png`, `${APP}/tarjeta-destacada-390.png`],
  ["07-tarjeta-secundaria", `${REF}/t4-f30.png`, `${APP}/tarjeta-secundaria-390.png`],
  ["08-menu", `${REF}/t4-f30.png`, `${APP}/menu-390x844.png`],
  ["09-scroll", `${REF}/t4-f12.png`, `${APP}/menu-scrolled-390x844.png`],
  ["10-cambio-categoria", `${REF}/t6-f21.png`, `${APP}/menu-categoria-carnes-390x844.png`],
  ["11-tarjeta-a-detalle", `${REF}/t5-f20.png`, `${FRAMES}/flow3-morph-04.png`],
  ["12-detalle", `${REF}/t6-f10.png`, `${APP}/detalle-390x844.png`],
  ["13-regreso", `${REF}/t6-f21.png`, `${APP}/menu-regreso-390x844.png`],
  ["14-navegacion-inferior", `${REF}/t4-f30.png`, `${APP}/bottom-nav-390.png`],
];

async function fitToHeight(file: string): Promise<{ buf: Buffer; width: number }> {
  const resized = await sharp(file).resize({ height: HEIGHT }).png().toBuffer();
  const meta = await sharp(resized).metadata();
  return { buf: resized, width: meta.width ?? 0 };
}

async function compose(name: string, refFile: string, appFile: string): Promise<void> {
  for (const file of [refFile, appFile]) {
    if (!fs.existsSync(file)) {
      console.warn(`⚠ Falta ${file}; se omite ${name}`);
      return;
    }
  }
  const left = await fitToHeight(refFile);
  const right = await fitToHeight(appFile);
  const width = left.width + GUTTER + right.width;
  await sharp({
    create: { width, height: HEIGHT, channels: 4, background: NAVY },
  })
    .composite([
      { input: left.buf, left: 0, top: 0 },
      { input: right.buf, left: left.width + GUTTER, top: 0 },
    ])
    .png()
    .toFile(path.join(OUT, `${name}.png`));
  console.log(`✓ ${name}`);
}

async function main(): Promise<void> {
  if (!fs.existsSync(REF)) {
    throw new Error(
      `No existe ${REF}. Los fotogramas de referencia privados se retiraron durante la sanitizacion publica; restaure un corpus autorizado fuera de Git antes de generar comparaciones.`,
    );
  }
  fs.mkdirSync(OUT, { recursive: true });
  for (const [name, refFile, appFile] of PAIRS) {
    await compose(name, refFile, appFile);
  }
  console.log("Comparaciones en", OUT);
}

main().catch((error) => {
  console.error("✖ Error componiendo:", error);
  process.exit(1);
});
