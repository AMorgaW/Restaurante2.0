/**
 * Inyección de JSON-LD. El contenido se serializa desde objetos propios
 * (nunca entrada del usuario) y se sanitiza `<` para impedir cierre de
 * la etiqueta script; es el único uso justificado de
 * dangerouslySetInnerHTML en el proyecto.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
