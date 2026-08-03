/**
 * Validación de coherencia entre `images/`, las copias públicas y el
 * manifiesto generado. Sale con código ≠ 0 si hay inconsistencias duras.
 *
 * Ejecutar con: npm run validate:images
 */
import { promises as fs } from "node:fs";
import path from "node:path";

import { menuManifest } from "../src/data/generated/menu-manifest";
import { hasSupportedExtension } from "../src/lib/images/naming";

const PROJECT_ROOT = process.cwd();
const NON_MENU_IMAGE_FILENAMES = new Set(["inicio.png"]);

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  const imagesDir = path.join(PROJECT_ROOT, "images");
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!(await fileExists(imagesDir))) {
    console.error("✖ No existe la carpeta images/.");
    process.exit(1);
  }

  const slugs = new Set<string>();
  for (const item of menuManifest) {
    if (slugs.has(item.slug)) {
      errors.push(`Slug duplicado en el manifiesto: ${item.slug}`);
    }
    slugs.add(item.slug);

    const original = path.join(imagesDir, item.image.originalFilename);
    if (!(await fileExists(original))) {
      errors.push(`Falta el original de “${item.slug}”: images/${item.image.originalFilename}`);
    }

    const publicCopy = path.join(PROJECT_ROOT, "public", item.image.publicPath);
    if (!(await fileExists(publicCopy))) {
      errors.push(`Falta la copia pública ${item.image.publicPath} (ejecuta npm run generate:menu)`);
    } else {
      const [originalStat, copyStat] = await Promise.all([
        fs.stat(original).catch(() => null),
        fs.stat(publicCopy),
      ]);
      if (originalStat && originalStat.size !== copyStat.size) {
        errors.push(
          `La copia de “${item.slug}” difiere del original (${copyStat.size} ≠ ${originalStat.size} bytes); regenera el menú.`,
        );
      }
    }

    if (!item.image.blurDataURL.startsWith("data:image/")) {
      errors.push(`blurDataURL inválido para “${item.slug}”.`);
    }
    if (item.image.width < 200 || item.image.height < 200) {
      warnings.push(
        `“${item.slug}” tiene baja resolución (${item.image.width}x${item.image.height}); se recomienda ≥ 800px.`,
      );
    }
  }

  // Imágenes nuevas sin manifestar.
  const entries = await fs.readdir(imagesDir);
  const manifested = new Set(menuManifest.map((item) => item.image.originalFilename));
  for (const entry of entries) {
    if (hasSupportedExtension(entry) && !NON_MENU_IMAGE_FILENAMES.has(entry.toLowerCase()) && !manifested.has(entry)) {
      warnings.push(`images/${entry} no está en el manifiesto; ejecuta npm run generate:menu.`);
    }
  }

  for (const warning of warnings) console.log(`⚠ ${warning}`);
  if (errors.length > 0) {
    for (const error of errors) console.error(`✖ ${error}`);
    process.exit(1);
  }
  console.log(`✓ ${menuManifest.length} imágenes validadas correctamente.`);
}

main().catch((error) => {
  console.error("✖ Error inesperado validando imágenes:", error);
  process.exit(1);
});
