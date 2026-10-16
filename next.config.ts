import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

/**
 * Content Security Policy compatible con Next.js (App Router).
 * - 'unsafe-inline' en script-src es necesario para los scripts inline de Next
 *   sin infraestructura de nonces; se compensa con el resto de directivas.
 * - En desarrollo se añade 'unsafe-eval' (React Refresh) y ws: (HMR).
 * - Si Supabase está configurado, se permite connect-src hacia su dominio.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${supabaseUrl ? ` ${supabaseUrl} ${supabaseUrl.replace("https://", "wss://")}` : ""}${isDev ? " ws:" : ""}`,
  "manifest-src 'self'",
  "worker-src 'self'",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
]
  .join("; ")
  .trim();

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  images: {
    formats: ["image/avif", "image/webp"],
    // Todas las imágenes son locales (public/generated/menu); no se permiten dominios remotos.
    remotePatterns: [],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
      {
        // La consulta de comprobantes nunca debe enviar el origen de la navegación.
        source: "/api/order-receipt",
        headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
      },
      {
        // El service worker debe poder actualizarse de inmediato.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
