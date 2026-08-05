import Link from "next/link";
import { BrandMark } from "@/components/layout/brand-mark";
import { restaurantConfig } from "@/config/restaurant";

const FOOTER_LINKS: Array<{ title: string; links: Array<{ href: string; label: string }> }> = [
  {
    title: "Explora",
    links: [
      { href: "/menu", label: "Menú" },
      { href: "/promociones", label: "Promociones" },
      { href: "/sucursales", label: "Sucursales" },
    ],
  },
  {
    title: "Ayuda",
    links: [
      { href: "/preguntas-frecuentes", label: "Preguntas frecuentes" },
      { href: "/alergenos", label: "Alérgenos" },
      { href: "/contacto", label: "Contacto" },
      { href: "/nosotros", label: "Nosotros" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/terminos", label: "Términos y condiciones" },
      { href: "/privacidad", label: "Privacidad" },
      { href: "/cookies", label: "Cookies" },
      { href: "/admin", label: "Administración" },
    ],
  },
];

/** Pie de página con navegación secundaria y enlaces legales. */
export function Footer() {
  return (
    <footer className="mt-10 border-t border-border-soft bg-background-secondary/60">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 md:px-6">
        <div className="flex flex-col gap-6 md:flex-row md:justify-between">
          <div className="max-w-xs">
            <BrandMark size="sm" />
            <p className="mt-3 text-sm leading-relaxed text-muted">{restaurantConfig.tagline}.</p>
          </div>
          <nav aria-label="Enlaces del pie" className="grid grid-cols-2 gap-6 xs:grid-cols-3">
            {FOOTER_LINKS.map((group) => (
              <div key={group.title}>
                <h2 className="text-[13px] font-bold uppercase tracking-wide text-faint">
                  {group.title}
                </h2>
                <ul className="mt-3 flex flex-col gap-2">
                  {group.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="text-sm text-muted transition-colors hover:text-foreground"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>
        <p className="text-[12px] text-faint">
          © {new Date().getFullYear()} {restaurantConfig.legalName} · Sitio de demostración: datos
          comerciales pendientes de validación.
        </p>
      </div>
    </footer>
  );
}
