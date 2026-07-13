import { branches, restaurantConfig } from "@/config/restaurant";
import { getCategoryBySlug } from "@/lib/menu/categories";
import { siteUrl } from "@/lib/env/client";
import type { Branch } from "@/types/restaurant";
import type { MenuItem } from "@/types/menu";

/**
 * Constructores de JSON-LD (schema.org). Solo usan datos configurados
 * en src/config/restaurant.ts; no se inventa información comercial.
 */

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

function openingHoursSpecification(branch: Branch) {
  return branch.openingHours
    .filter((entry) => !entry.isClosed)
    .map((entry) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: DAY_NAMES[entry.dayOfWeek],
      opens: entry.openingTime,
      closes: entry.closingTime,
    }));
}

function branchToLocalBusiness(branch: Branch) {
  return {
    "@type": "Restaurant",
    "@id": `${siteUrl}/sucursales/${branch.slug}`,
    name: branch.name,
    url: `${siteUrl}/sucursales/${branch.slug}`,
    telephone: branch.phone,
    email: branch.email,
    servesCuisine: ["Parrilla", "Cocina latinoamericana"],
    address: {
      "@type": "PostalAddress",
      streetAddress: branch.address,
      addressLocality: branch.city,
      addressCountry: "CO",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: branch.latitude,
      longitude: branch.longitude,
    },
    openingHoursSpecification: openingHoursSpecification(branch),
  };
}

export function restaurantJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    "@id": `${siteUrl}#restaurant`,
    name: restaurantConfig.name,
    description: restaurantConfig.description,
    url: siteUrl,
    telephone: restaurantConfig.contact.phone,
    email: restaurantConfig.contact.email,
    image: `${siteUrl}/generated/og-image.jpg`,
    servesCuisine: ["Parrilla", "Cocina latinoamericana"],
    priceRange: "$$",
    address: {
      "@type": "PostalAddress",
      streetAddress: branches[0]?.address ?? "",
      addressLocality: branches[0]?.city ?? "",
      addressCountry: "CO",
    },
    department: branches.map(branchToLocalBusiness),
    parentOrganization: {
      "@type": "Organization",
      name: restaurantConfig.legalName,
    },
  };
}

export function branchJsonLd(branch: Branch) {
  return {
    "@context": "https://schema.org",
    ...branchToLocalBusiness(branch),
  };
}

function itemOffer(item: MenuItem) {
  const { decimals, code } = restaurantConfig.currency;
  return {
    "@type": "Offer",
    price: (item.price / 10 ** decimals).toFixed(decimals > 0 ? 2 : 0),
    priceCurrency: code,
    availability: item.available ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
  };
}

export function menuItemJsonLd(item: MenuItem) {
  return {
    "@context": "https://schema.org",
    "@type": "MenuItem",
    "@id": `${siteUrl}/plato/${item.slug}`,
    name: item.fullName,
    description: item.shortDescription,
    url: `${siteUrl}/plato/${item.slug}`,
    image: `${siteUrl}${item.image.publicPath}`,
    menuAddOn: item.modifierGroups.map((group) => ({
      "@type": "MenuSection",
      name: group.name,
      hasMenuItem: group.options.map((option) => ({
        "@type": "MenuItem",
        name: option.name,
      })),
    })),
    offers: itemOffer(item),
  };
}

export function menuJsonLd(items: MenuItem[]) {
  const byCategory = new Map<string, MenuItem[]>();
  for (const item of items) {
    const list = byCategory.get(item.categorySlug) ?? [];
    list.push(item);
    byCategory.set(item.categorySlug, list);
  }

  return {
    "@context": "https://schema.org",
    "@type": "Menu",
    "@id": `${siteUrl}/menu#menu`,
    name: `Menú de ${restaurantConfig.name}`,
    url: `${siteUrl}/menu`,
    hasMenuSection: Array.from(byCategory.entries()).map(([categorySlug, sectionItems]) => {
      const category = getCategoryBySlug(categorySlug);
      return {
        "@type": "MenuSection",
        name: category.name,
        hasMenuItem: sectionItems.map((item) => ({
          "@type": "MenuItem",
          name: item.fullName,
          url: `${siteUrl}/plato/${item.slug}`,
          image: `${siteUrl}${item.image.publicPath}`,
          offers: itemOffer(item),
        })),
      };
    }),
  };
}
