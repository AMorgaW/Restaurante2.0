import type { Metadata } from "next";
import { InfoPage } from "@/components/layout/info-page";
import { restaurantConfig } from "@/config/restaurant";
import { siteUrl } from "@/lib/env/client";

export const metadata: Metadata = {
  title: "Términos y condiciones",
  description: "Condiciones de uso y de compra.",
  alternates: { canonical: `${siteUrl}/terminos` },
};

export default function TermsPage() {
  return (
    <InfoPage
      title="Términos y condiciones"
      intro="Condiciones de uso del sitio y de compra de productos."
      requiresLegalReview
    >
      <section className="flex flex-col gap-3">
        <h2>1. Identificación</h2>
        <p>
          Este sitio es operado por {restaurantConfig.legalName}. Contacto:{" "}
          <strong>{restaurantConfig.contact.email}</strong>.
        </p>
      </section>
      <section className="flex flex-col gap-3">
        <h2>2. Pedidos</h2>
        <ul>
          <li>Los precios se muestran en la moneda local e incluyen los impuestos indicados en el resumen.</li>
          <li>El pedido se confirma al completar el checkout; recibirás un número de pedido.</li>
          <li>Los tiempos de preparación y entrega son estimados y pueden variar según demanda.</li>
          <li>El pedido mínimo y la tarifa de domicilio se muestran antes de confirmar.</li>
        </ul>
      </section>
      <section className="flex flex-col gap-3">
        <h2>3. Cancelaciones y cambios de pedidos</h2>
        <p>
          Puedes solicitar cambios o cancelación contactando de inmediato a la sucursal. Si la
          preparación ya inició, la cancelación puede no ser posible. Los reembolsos, cuando
          apliquen, se procesan por el mismo medio de pago.
        </p>
      </section>
      <section className="flex flex-col gap-3">
        <h2>4. Reservas</h2>
        <p>
          La mesa se mantiene disponible durante 15 minutos después de la hora reservada. Puedes
          cancelar tu reserva desde la sección de reservas o contactando a la sucursal.
        </p>
      </section>
      <section className="flex flex-col gap-3">
        <h2>5. Uso aceptable</h2>
        <p>
          Te comprometes a proporcionar información veraz y a no usar el sitio para fines
          fraudulentos o que afecten su funcionamiento.
        </p>
      </section>
      <section className="flex flex-col gap-3">
        <h2>6. Modificaciones</h2>
        <p>
          Podemos actualizar estos términos; la versión vigente estará siempre publicada en esta
          página.
        </p>
      </section>
    </InfoPage>
  );
}
