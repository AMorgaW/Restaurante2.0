import { describe, expect, it } from "vitest";
import {
  ensureUniqueSlug,
  hasSupportedExtension,
  parseFilename,
  removeDiacritics,
  slugify,
  stripExtension,
} from "@/lib/images/naming";

describe("hasSupportedExtension", () => {
  it("acepta las extensiones soportadas sin importar mayúsculas", () => {
    expect(hasSupportedExtension("plato.jpg")).toBe(true);
    expect(hasSupportedExtension("plato.JPG")).toBe(true);
    expect(hasSupportedExtension("plato.jpeg")).toBe(true);
    expect(hasSupportedExtension("plato.png")).toBe(true);
    expect(hasSupportedExtension("plato.webp")).toBe(true);
    expect(hasSupportedExtension("plato.avif")).toBe(true);
  });

  it("rechaza extensiones no soportadas", () => {
    expect(hasSupportedExtension("plato.gif")).toBe(false);
    expect(hasSupportedExtension("plato.pdf")).toBe(false);
    expect(hasSupportedExtension("plato")).toBe(false);
  });
});

describe("stripExtension", () => {
  it("elimina solo la extensión final", () => {
    expect(stripExtension("hamburguesa.doble.jpg")).toBe("hamburguesa.doble");
    expect(stripExtension("Sopa..JPG")).toBe("Sopa.");
  });
});

describe("parseFilename", () => {
  it("convierte guiones bajos en espacios", () => {
    expect(parseFilename("spaghetti_bolognese.jpg").fullName).toBe("Spaghetti bolognese");
  });

  it("convierte guiones en espacios", () => {
    expect(parseFilename("pollo-a-la-parrilla.png").fullName).toBe("Pollo a la parrilla");
  });

  it("conserva paréntesis y comas", () => {
    expect(parseFilename("Tacos de carne (especial).webp").fullName).toBe(
      "Tacos de carne (especial)",
    );
    expect(parseFilename("Arroz amarillo, carne asada, frijoles..JPG").fullName).toBe(
      "Arroz amarillo, carne asada, frijoles",
    );
  });

  it("conserva tildes y eñes", () => {
    const parsed = parseFilename("Sopa de maíz con arroz y frijoles..JPG");
    expect(parsed.fullName).toBe("Sopa de maíz con arroz y frijoles");
  });

  it("trata puntos pegados como separadores de palabra", () => {
    expect(parseFilename("hamburguesa.doble.artesanal.jpg").fullName).toBe(
      "Hamburguesa doble artesanal",
    );
  });

  it("separa nombre y descripción cuando hay frase con punto y espacio", () => {
    const parsed = parseFilename("Plato de carne asada. Vistas a una bandeja de carne asada..JPG");
    expect(parsed.fullName).toBe("Plato de carne asada");
    expect(parsed.descriptionFromFilename).toBe("Vistas a una bandeja de carne asada");
  });

  it("maneja nombres extremadamente largos sin recortarlos", () => {
    const longName =
      "Carne asada ternera a la parrilla con cebollas, jalapeño, frijoles, arroz, pico de gallo, guacamole, crema y lima..JPG";
    const parsed = parseFilename(longName);
    expect(parsed.fullName.length).toBeGreaterThan(100);
    expect(parsed.fullName.startsWith("Carne asada ternera")).toBe(true);
    expect(parsed.fullName.endsWith("lima")).toBe(true);
  });

  it("colapsa espacios duplicados", () => {
    expect(parseFilename("carne   asada    especial.jpg").fullName).toBe("Carne asada especial");
  });

  it("capitaliza la primera letra sin alterar el resto", () => {
    expect(parseFilename("costillas BBQ.jpg").fullName).toBe("Costillas BBQ");
  });

  it("convierte nombres totalmente en mayúsculas a capitalización natural", () => {
    expect(parseFilename("SOPA DE POLLO.jpg").fullName).toBe("Sopa de pollo");
  });

  it("conserva rangos numéricos con guion", () => {
    expect(parseFilename("combo 2-3 personas.jpg").fullName).toBe("Combo 2-3 personas");
  });

  it("devuelve nombre vacío para archivos sin texto útil", () => {
    expect(parseFilename("...jpg").fullName).toBe("");
  });
});

describe("removeDiacritics", () => {
  it("elimina tildes conservando la letra base", () => {
    expect(removeDiacritics("maíz jalapeños ñoño áéíóú")).toBe("maiz jalapenos nono aeiou");
  });
});

describe("slugify", () => {
  it("genera slugs URL-safe en minúsculas", () => {
    expect(slugify("Sopa de maíz con arroz y frijoles")).toBe("sopa-de-maiz-con-arroz-y-frijoles");
  });

  it("elimina caracteres especiales", () => {
    expect(slugify("Tacos de carne (especial)")).toBe("tacos-de-carne-especial");
  });

  it("recorta slugs muy largos en un límite de palabra", () => {
    const slug = slugify(
      "Carne asada ternera a la parrilla con cebollas, jalapeño, frijoles, arroz, pico de gallo, guacamole, crema y lima",
    );
    expect(slug.length).toBeLessThanOrEqual(80);
    expect(slug.endsWith("-")).toBe(false);
  });
});

describe("ensureUniqueSlug", () => {
  it("añade sufijos estables en colisiones", () => {
    const used = new Map<string, number>();
    expect(ensureUniqueSlug("carne-asada", used)).toBe("carne-asada");
    expect(ensureUniqueSlug("carne-asada", used)).toBe("carne-asada-2");
    expect(ensureUniqueSlug("carne-asada", used)).toBe("carne-asada-3");
  });

  it("evita colisiones con sufijos naturales existentes", () => {
    const used = new Map<string, number>();
    expect(ensureUniqueSlug("plato-2", used)).toBe("plato-2");
    expect(ensureUniqueSlug("plato", used)).toBe("plato");
    // "plato" colisiona → probaría "plato-2", que ya existe → "plato-2-2"
    expect(ensureUniqueSlug("plato", used)).toBe("plato-2-2");
  });

  it("usa un slug base para nombres vacíos", () => {
    const used = new Map<string, number>();
    expect(ensureUniqueSlug("", used)).toBe("plato");
  });
});
