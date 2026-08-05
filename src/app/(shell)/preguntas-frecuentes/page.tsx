import type { Metadata } from "next";
import { InfoPage } from "@/components/layout/info-page";
import { restaurantConfig } from "@/config/restaurant";
import { siteUrl } from "@/lib/env/client";

export const metadata: Metadata = {
  title: "Preguntas frecuentes",
  description: "Respuestas a las dudas más comunes sobre pedidos y servicios.",
  alternates: { canonical: `${siteUrl}/preguntas-frecuentes` },
};

const FAQS = [
  {
    question: "¿Cómo hago un pedido?",
    answer:
      "Explora el menú, añade tus platos al carrito y sigue los pasos del checkout. En modo demostración el pedido se confirma sin ningún cobro real.",
  },
  {
    question: "¿Puedo pedir a domicilio?",
    answer:
      "Sí, en las sucursales con servicio de domicilio activo. La tarifa y el pedido mínimo se muestran antes de confirmar.",
  },
  {
    question: "¿Tienen opciones para alergias o dietas especiales?",
    answer:
      "Consulta con el restaurante los ingredientes y posibles alérgenos antes de realizar tu pedido; nuestro equipo te orientará con gusto. Más información en la página de alérgenos.",
  },
  {
    question: "¿Qué métodos de pago aceptan?",
    answer:
      "La versión de demostración usa un pago simulado sin cobro real. En producción se habilitan tarjeta (Stripe) y Mercado Pago según la configuración del restaurante.",
  },
  {
    question: "¿Cómo cambio o corrijo un pedido ya realizado?",
    answer: `Comunícate de inmediato con la sucursal por teléfono o WhatsApp (sección Contacto) indicando tu número de pedido. Correo general: ${restaurantConfig.contact.email}.`,
  },
];

export default function FaqPage() {
  return (
    <InfoPage
      title="Preguntas frecuentes"
      intro="Si no encuentras tu respuesta, escríbenos desde la página de contacto."
    >
      <div className="flex flex-col gap-3">
        {FAQS.map((faq) => (
          <details
            key={faq.question}
            className="group rounded-card border border-border-soft bg-surface px-4 py-1 open:pb-4"
          >
            <summary className="flex min-h-13 cursor-pointer list-none items-center justify-between gap-3 py-3 text-[15px] font-bold text-foreground [&::-webkit-details-marker]:hidden">
              {faq.question}
              <span
                aria-hidden
                className="shrink-0 text-lime transition-transform group-open:rotate-45"
              >
                +
              </span>
            </summary>
            <p className="text-sm leading-relaxed text-muted">{faq.answer}</p>
          </details>
        ))}
      </div>
    </InfoPage>
  );
}
