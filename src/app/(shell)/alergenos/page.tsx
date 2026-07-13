import type { Metadata } from "next";
import { InfoPage } from "@/components/layout/info-page";
import { restaurantConfig } from "@/config/restaurant";
import { siteUrl } from "@/lib/env/client";

export const metadata: Metadata = {
  title: "Información de alérgenos",
  description: "Cómo consultamos y comunicamos alérgenos e ingredientes.",
  alternates: { canonical: `${siteUrl}/alergenos` },
};

export default function AllergensPage() {
  return (
    <InfoPage
      title="Alérgenos e ingredientes"
      intro="Tu seguridad alimentaria es nuestra prioridad."
      requiresLegalReview
    >
      <section className="flex flex-col gap-3">
        <h2>Nuestra política</h2>
        <p>
          Consulta con el restaurante los ingredientes y posibles alérgenos antes de realizar tu
          pedido. Nuestro equipo de cocina puede informarte sobre la composición de cada plato y
          las alternativas disponibles.
        </p>
        <p>
          Los platos del menú digital solo muestran información de ingredientes y alérgenos cuando
          el restaurante la ha registrado explícitamente; nunca se deduce automáticamente de las
          fotografías.
        </p>
      </section>
      <section className="flex flex-col gap-3">
        <h2>Alérgenos comunes a consultar</h2>
        <ul>
          <li>Gluten y derivados del trigo</li>
          <li>Lácteos</li>
          <li>Huevo</li>
          <li>Frutos secos y maní</li>
          <li>Pescados y mariscos</li>
          <li>Soya</li>
          <li>Apio, mostaza y sésamo</li>
        </ul>
      </section>
      <section className="flex flex-col gap-3">
        <h2>Cocina compartida</h2>
        <p>
          Nuestros platos se preparan en una cocina que manipula múltiples ingredientes; no podemos
          garantizar la ausencia total de trazas. Si tienes una alergia severa, indícalo SIEMPRE al
          personal antes de ordenar.
        </p>
        <p>
          Contacto directo: <strong>{restaurantConfig.contact.phone}</strong> ·{" "}
          <strong>{restaurantConfig.contact.email}</strong>
        </p>
      </section>
    </InfoPage>
  );
}
