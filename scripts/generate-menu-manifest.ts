/**
 * Generador determinista del manifiesto de menú a partir de `images/`.
 *
 * - NUNCA modifica ni borra los archivos originales.
 * - Copia versiones normalizadas a `public/generated/menu/<slug>.<ext>`.
 * - Emite un manifiesto tipado en `src/data/generated/menu-manifest.ts`.
 * - Genera iconos PWA y la imagen social por defecto.
 * - No falla por una imagen corrupta: la excluye y lo reporta.
 * - La regeneración no produce cambios si nada cambió (idempotente).
 *
 * Ejecutar con: npm run generate:menu
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";

import {
  ensureUniqueSlug,
  hasSupportedExtension,
  parseFilename,
  slugify,
} from "../src/lib/images/naming";
import { inferCategorySlug } from "../src/lib/menu/categories";
import type { MenuManifestItem } from "../src/types/menu";

const PROJECT_ROOT = process.cwd();
const OUTPUT_PUBLIC_DIR = path.join(PROJECT_ROOT, "public", "generated", "menu");
const OUTPUT_MANIFEST = path.join(PROJECT_ROOT, "src", "data", "generated", "menu-manifest.ts");
const OUTPUT_REPORT = path.join(PROJECT_ROOT, "artifacts", "image-report.json");
const ICONS_DIR = path.join(PROJECT_ROOT, "public", "icons");
const OG_IMAGE = path.join(PROJECT_ROOT, "public", "generated", "og-image.jpg");

const IGNORED_FILENAMES = new Set(["thumbs.db", "desktop.ini", ".ds_store"]);

interface ExclusionEntry {
  file: string;
  reason: string;
}

/** Firmas binarias reales; la extensión sola no es confiable. */
function detectImageFormat(buffer: Buffer): "jpeg" | "png" | "webp" | "avif" | null {
  if (buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "jpeg";
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return "png";
  if (buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP")
    return "webp";
  if (buffer.subarray(4, 12).toString("ascii").startsWith("ftyp")) {
    const brand = buffer.subarray(8, 12).toString("ascii");
    if (brand.startsWith("avif") || brand.startsWith("avis")) return "avif";
  }
  return null;
}

const FORMAT_EXTENSION: Record<string, string> = {
  jpeg: "jpg",
  png: "png",
  webp: "webp",
  avif: "avif",
};

async function findImagesDir(): Promise<string | null> {
  const candidates = [
    path.join(PROJECT_ROOT, "images"),
    path.join(PROJECT_ROOT, "Restaurante2.0", "images"),
  ];
  for (const candidate of candidates) {
    try {
      const stat = await fs.stat(candidate);
      if (stat.isDirectory()) return candidate;
    } catch {
      // seguir buscando
    }
  }
  return null;
}

/** Escribe un archivo solo si su contenido cambió (regeneración idempotente). */
async function writeIfChanged(filePath: string, content: Buffer | string): Promise<boolean> {
  const next = typeof content === "string" ? Buffer.from(content, "utf8") : content;
  try {
    const current = await fs.readFile(filePath);
    if (current.equals(next)) return false;
  } catch {
    // el archivo no existe todavía
  }
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, next);
  return true;
}

function buildManifestSource(items: MenuManifestItem[]): string {
  const serialized = JSON.stringify(items, null, 2);
  return `// ⚠ ARCHIVO AUTOGENERADO por scripts/generate-menu-manifest.ts — NO EDITAR A MANO.
// Los nombres provienen de los archivos en images/; usa src/data/menu-overrides.ts para corregirlos.
// Regenerar con: npm run generate:menu
import type { MenuManifestItem } from "@/types/menu";

export const menuManifest: MenuManifestItem[] = ${serialized};
`;
}

/** Icono geométrico propio (llama sobre navy) — sin fuentes ni recursos externos. */
function brandIconSvg(maskable: boolean): string {
  const pad = maskable ? 84 : 0;
  const radius = maskable ? 0 : 118;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${radius}" fill="#020118"/>
  <g transform="translate(${pad}, ${pad}) scale(${(512 - pad * 2) / 512})">
    <path d="M262 74c22 66-4 104-38 138-30 30-52 62-52 108 0 64 50 112 112 112s110-48 110-112c0-38-16-70-40-94-6 32-22 50-44 56 16-48 8-124-48-208z" fill="#FDF501"/>
    <ellipse cx="284" cy="330" rx="44" ry="52" fill="#B7FF3C" opacity="0.92"/>
    <ellipse cx="284" cy="352" rx="26" ry="32" fill="#031C80"/>
  </g>
</svg>`;
}

async function generateBrandAssets(firstImagePath: string | null): Promise<string[]> {
  const written: string[] = [];
  const targets: Array<{ file: string; size: number; maskable: boolean }> = [
    { file: "icon-192.png", size: 192, maskable: false },
    { file: "icon-512.png", size: 512, maskable: false },
    { file: "icon-maskable-512.png", size: 512, maskable: true },
    { file: "apple-touch-icon.png", size: 180, maskable: true },
  ];
  for (const target of targets) {
    const svg = Buffer.from(brandIconSvg(target.maskable));
    const png = await sharp(svg).resize(target.size, target.size).png().toBuffer();
    if (await writeIfChanged(path.join(ICONS_DIR, target.file), png)) {
      written.push(`public/icons/${target.file}`);
    }
  }

  if (firstImagePath) {
    const og = await sharp(firstImagePath)
      .resize(1200, 630, { fit: "cover", position: "attention" })
      .jpeg({ quality: 80 })
      .toBuffer();
    if (await writeIfChanged(OG_IMAGE, og)) {
      written.push("public/generated/og-image.jpg");
    }
  }
  return written;
}

async function main(): Promise<void> {
  const imagesDir = await findImagesDir();
  if (!imagesDir) {
    console.error(
      "✖ No se encontró la carpeta de imágenes. Crea `images/` en la raíz del proyecto y añade fotografías (.jpg, .jpeg, .png, .webp, .avif).",
    );
    process.exit(1);
  }

  const resolvedImagesDir = path.resolve(imagesDir);
  const entries = await fs.readdir(imagesDir, { withFileTypes: true });

  const excluded: ExclusionEntry[] = [];
  const ignored: ExclusionEntry[] = [];
  const warnings: string[] = [];

  const candidates: string[] = [];
  for (const entry of entries) {
    const name = entry.name;
    if (!entry.isFile()) {
      ignored.push({ file: name, reason: "No es un archivo" });
      continue;
    }
    if (name.startsWith(".") || IGNORED_FILENAMES.has(name.toLowerCase())) {
      ignored.push({ file: name, reason: "Archivo oculto o metadato del sistema" });
      continue;
    }
    if (!hasSupportedExtension(name)) {
      ignored.push({ file: name, reason: "Extensión no soportada (no es imagen)" });
      continue;
    }
    // Protección anti path-traversal: el archivo debe residir dentro de images/.
    const resolved = path.resolve(imagesDir, name);
    if (!resolved.startsWith(resolvedImagesDir + path.sep)) {
      excluded.push({ file: name, reason: "Ruta fuera de la carpeta de imágenes" });
      continue;
    }
    candidates.push(name);
  }

  // Orden determinista de procesamiento (asignación estable de slugs).
  candidates.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  const usedSlugs = new Map<string, number>();
  const items: MenuManifestItem[] = [];
  const copiesWritten: string[] = [];

  for (const filename of candidates) {
    const filePath = path.join(imagesDir, filename);
    try {
      const buffer = await fs.readFile(filePath);
      const format = detectImageFormat(buffer);
      if (!format) {
        excluded.push({
          file: filename,
          reason: "El contenido no corresponde a una imagen válida (firma binaria desconocida)",
        });
        continue;
      }

      const image = sharp(buffer);
      const metadata = await image.metadata();
      const width = metadata.width ?? 0;
      const height = metadata.height ?? 0;
      if (width < 16 || height < 16) {
        excluded.push({ file: filename, reason: "Dimensiones inválidas o ilegibles" });
        continue;
      }

      const parsed = parseFilename(filename);
      if (parsed.fullName.length === 0) {
        excluded.push({ file: filename, reason: "El nombre no produce un título legible" });
        continue;
      }
      if (parsed.fullName.length > 100) {
        warnings.push(
          `“${filename}” produce un nombre de ${parsed.fullName.length} caracteres; la interfaz lo maneja, pero puedes definir shortName en menu-overrides.ts.`,
        );
      }

      const slug = ensureUniqueSlug(slugify(parsed.fullName), usedSlugs);
      const extension = FORMAT_EXTENSION[format] ?? "jpg";
      const publicFilename = `${slug}.${extension}`;
      const publicAbsolute = path.join(OUTPUT_PUBLIC_DIR, publicFilename);

      // Copia byte a byte: conserva la calidad original y es determinista.
      if (await writeIfChanged(publicAbsolute, buffer)) {
        copiesWritten.push(publicFilename);
      }

      const blurBuffer = await sharp(buffer).resize(16).webp({ quality: 40 }).toBuffer();

      items.push({
        id: slug,
        slug,
        fullName: parsed.fullName,
        ...(parsed.descriptionFromFilename
          ? { descriptionFromFilename: parsed.descriptionFromFilename }
          : {}),
        categorySlug: inferCategorySlug(parsed.fullName),
        image: {
          originalFilename: filename,
          publicPath: `/generated/menu/${publicFilename}`,
          width,
          height,
          aspectRatio: Math.round((width / height) * 1000) / 1000,
          hasAlpha: Boolean(metadata.hasAlpha),
          blurDataURL: `data:image/webp;base64,${blurBuffer.toString("base64")}`,
          bytes: buffer.length,
        },
      });
    } catch (error) {
      excluded.push({
        file: filename,
        reason: `No se pudo procesar: ${error instanceof Error ? error.message : "error desconocido"}`,
      });
    }
  }

  if (items.length === 0) {
    console.error(
      "✖ No se encontró ninguna imagen válida en " +
        imagesDir +
        ". Añade fotografías .jpg/.jpeg/.png/.webp/.avif y vuelve a ejecutar `npm run generate:menu`.",
    );
    process.exit(1);
  }

  // Orden estable del manifiesto.
  items.sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));

  const manifestChanged = await writeIfChanged(OUTPUT_MANIFEST, buildManifestSource(items));

  const firstImageOriginal = items[0]
    ? path.join(imagesDir, items[0].image.originalFilename)
    : null;
  const brandWritten = await generateBrandAssets(firstImageOriginal);

  const report = {
    imagesDir: path.relative(PROJECT_ROOT, imagesDir) || ".",
    totalEntries: entries.length,
    included: items.map((item) => ({
      original: item.image.originalFilename,
      slug: item.slug,
      fullName: item.fullName,
      category: item.categorySlug,
      dimensions: `${item.image.width}x${item.image.height}`,
    })),
    excluded,
    ignored,
    warnings,
  };
  await writeIfChanged(OUTPUT_REPORT, JSON.stringify(report, null, 2));

  // Resumen legible.
  console.log("── Generación de menú ─────────────────────────────");
  console.log(`Carpeta de imágenes : ${imagesDir}`);
  console.log(`Imágenes válidas    : ${items.length}`);
  console.log(`Excluidas           : ${excluded.length}`);
  console.log(`Ignoradas (no img)  : ${ignored.length}`);
  for (const entry of excluded) {
    console.log(`  ✖ ${entry.file} — ${entry.reason}`);
  }
  for (const warning of warnings) {
    console.log(`  ⚠ ${warning}`);
  }
  console.log(
    manifestChanged
      ? "Manifiesto actualizado: src/data/generated/menu-manifest.ts"
      : "Manifiesto sin cambios (idempotente).",
  );
  if (copiesWritten.length > 0) {
    console.log(`Copias normalizadas : ${copiesWritten.length} en public/generated/menu/`);
  }
  if (brandWritten.length > 0) {
    console.log(`Recursos de marca   : ${brandWritten.join(", ")}`);
  }
  console.log(`Informe             : artifacts/image-report.json`);
  console.log("───────────────────────────────────────────────────");
}

main().catch((error) => {
  console.error("✖ Error inesperado generando el manifiesto:", error);
  process.exit(1);
});
