import type { Metadata } from "next";
import { InfoPage } from "@/components/layout/info-page";
import { siteUrl } from "@/lib/env/client";

export const metadata: Metadata = {
  title: "Política de cookies",
  description: "Qué almacenamiento usamos y para qué.",
  alternates: { canonical: `${siteUrl}/cookies` },
};

export default function CookiesPage() {
  return (
    <InfoPage
      title="Política de cookies"
      intro="Transparencia total sobre el almacenamiento en tu dispositivo."
      requiresLegalReview
    >
      <section className="flex flex-col gap-3">
        <h2>Almacenamiento esencial</h2>
        <p>
          Usamos el almacenamiento local del navegador (no cookies de seguimiento) para funciones
          imprescindibles que tú mismo activas:
        </p>
        <ul>
          <li>Carrito de compras y preferencias de pedido.</li>
          <li>Platos favoritos.</li>
          <li>Recordar que ya viste la pantalla de bienvenida.</li>
          <li>Pedidos de demostración realizados en este navegador.</li>
        </ul>
        <p>Esta información no sale de tu dispositivo en el modo de demostración.</p>
      </section>
      <section className="flex flex-col gap-3">
        <h2>Cookies analíticas (opcionales)</h2>
        <p>
          La analítica está <strong>desactivada por defecto</strong>. Si el restaurante la activa,
          aparecerá un banner para aceptarla o rechazarla antes de cargar cualquier cookie no
          esencial; rechazar no limita ninguna función.
        </p>
      </section>
      <section className="flex flex-col gap-3">
        <h2>Cómo borrar los datos</h2>
        <p>
          Puedes eliminar todo el almacenamiento desde la configuración de tu navegador (borrar
          datos de sitios) en cualquier momento.
        </p>
      </section>
    </InfoPage>
  );
}
