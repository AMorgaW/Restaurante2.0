import type { Metadata } from "next";
import { InfoPage } from "@/components/layout/info-page";
import { restaurantConfig } from "@/config/restaurant";
import { siteUrl } from "@/lib/env/client";

export const metadata: Metadata = {
  title: "Política de privacidad",
  description: "Cómo tratamos tus datos personales.",
  alternates: { canonical: `${siteUrl}/privacidad` },
};

export default function PrivacyPage() {
  return (
    <InfoPage
      title="Política de privacidad"
      intro="Última revisión: plantilla de demostración."
      requiresLegalReview
    >
      <section className="flex flex-col gap-3">
        <h2>Responsable del tratamiento</h2>
        <p>
          {restaurantConfig.legalName}, con correo de contacto{" "}
          <strong>{restaurantConfig.contact.email}</strong>.
        </p>
      </section>
      <section className="flex flex-col gap-3">
        <h2>Qué datos tratamos</h2>
        <ul>
          <li>
            <strong>Pedidos:</strong> nombre, teléfono, correo y, si eliges domicilio, dirección de
            entrega. Se usan exclusivamente para preparar y entregar tu pedido.
          </li>
          <li>
            <strong>Reservas:</strong> nombre, teléfono, correo, fecha, hora y tamaño del grupo.
          </li>
          <li>
            <strong>Preferencias locales:</strong> favoritos, carrito y ajustes se guardan en tu
            propio navegador (almacenamiento local) y no se envían a servidores de terceros en el
            modo de demostración.
          </li>
        </ul>
      </section>
      <section className="flex flex-col gap-3">
        <h2>Lo que NO hacemos</h2>
        <ul>
          <li>No vendemos tus datos.</li>
          <li>No almacenamos números de tarjeta: los pagos los procesa el proveedor de pagos.</li>
          <li>No activamos analítica ni cookies no esenciales sin tu consentimiento.</li>
          <li>No enviamos comunicaciones comerciales sin tu autorización expresa (casilla opcional).</li>
        </ul>
      </section>
      <section className="flex flex-col gap-3">
        <h2>Tus derechos</h2>
        <p>
          Puedes solicitar acceso, corrección o eliminación de tus datos escribiendo a{" "}
          <strong>{restaurantConfig.contact.email}</strong>. Responderemos dentro de los plazos
          legales aplicables en tu país.
        </p>
      </section>
      <section className="flex flex-col gap-3">
        <h2>Conservación</h2>
        <p>
          Los datos de pedidos y reservas se conservan el tiempo necesario para la operación y las
          obligaciones fiscales del restaurante.
        </p>
      </section>
    </InfoPage>
  );
}
