import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import { ViewTransitions } from "next-view-transitions";
import { Providers } from "@/components/providers";
import { restaurantConfig } from "@/config/restaurant";
import { siteUrl } from "@/lib/env/client";
import "@/styles/globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${restaurantConfig.name} — ${restaurantConfig.tagline}`,
    template: `%s · ${restaurantConfig.name}`,
  },
  description: restaurantConfig.description,
  applicationName: restaurantConfig.name,
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: restaurantConfig.shortName,
  },
  openGraph: {
    type: "website",
    locale: "es_CO",
    siteName: restaurantConfig.name,
    title: `${restaurantConfig.name} — ${restaurantConfig.tagline}`,
    description: restaurantConfig.description,
    images: [{ url: "/generated/og-image.jpg", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${restaurantConfig.name} — ${restaurantConfig.tagline}`,
    description: restaurantConfig.description,
    images: ["/generated/og-image.jpg"],
  },
};

export const viewport: Viewport = {
  themeColor: "#020118",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "dark",
};

/**
 * Anti-destello del onboarding: antes del primer paint, si el usuario aún
 * no vio la bienvenida (solo en la ruta raíz), se oculta el shell hasta
 * que el gate monte el overlay. Con temporizador de seguridad para no
 * dejar la página oculta si algo fallara. Sin JS no se añade la clase y
 * el contenido se muestra normalmente.
 */
const ONBOARDING_PREPAINT_SCRIPT = `try{if(location.pathname==="/"){var v=localStorage.getItem("rb-onboarding");if(!v||v.indexOf('"seen":true')===-1){document.documentElement.classList.add("onb-pending");setTimeout(function(){document.documentElement.classList.remove("onb-pending")},1600)}}}catch(e){}`;

/**
 * Marca, en la PRIMERA carga completa de la pestaña, cuántas entradas de
 * historial existían al entrar a la app. Las navegaciones internas (SPA) no
 * recargan el documento, así que `history.length` solo crece por encima de
 * esta marca cuando hubo un paso interno previo. El botón "Volver" del
 * detalle usa esta marca para decidir entre `router.back()` (hay historial
 * interno) y un fallback seguro a `/menu` (entrada directa / deep link), sin
 * caer nunca en `about:blank`. Se fija una sola vez por sesión de pestaña.
 */
const ENTRY_HISTORY_SCRIPT = `try{if(sessionStorage.getItem("rb-entry-history-length")===null){sessionStorage.setItem("rb-entry-history-length",String(history.length))}}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransitions>
      {/* suppressHydrationWarning: el script anti-destello muta la clase de
          <html> ANTES de hidratar (onb-pending, por diseño); solo silencia
          la diferencia de atributos en este elemento. */}
      <html lang="es" className={manrope.variable} suppressHydrationWarning>
        <head>
          <script dangerouslySetInnerHTML={{ __html: ONBOARDING_PREPAINT_SCRIPT }} />
          <script dangerouslySetInnerHTML={{ __html: ENTRY_HISTORY_SCRIPT }} />
        </head>
        <body className="font-sans antialiased">
          <Providers>{children}</Providers>
        </body>
      </html>
    </ViewTransitions>
  );
}
