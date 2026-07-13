/**
 * Valores públicos disponibles en el cliente. Solo variables con prefijo
 * NEXT_PUBLIC_ (inyectadas en build); nunca contiene secretos.
 */
export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(
  /\/$/,
  "",
);
