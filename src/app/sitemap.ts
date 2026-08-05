import type { MetadataRoute } from "next";
import { branches } from "@/config/restaurant";
import { getCategoriesInUse, menuItems } from "@/data/menu";
import { siteUrl } from "@/lib/env/client";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: siteUrl, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/menu`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${siteUrl}/buscar`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${siteUrl}/promociones`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${siteUrl}/sucursales`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${siteUrl}/nosotros`, changeFrequency: "yearly", priority: 0.4 },
    { url: `${siteUrl}/contacto`, changeFrequency: "yearly", priority: 0.5 },
    { url: `${siteUrl}/preguntas-frecuentes`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${siteUrl}/alergenos`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${siteUrl}/privacidad`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${siteUrl}/terminos`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${siteUrl}/cookies`, changeFrequency: "yearly", priority: 0.2 },
  ];

  const categoryRoutes: MetadataRoute.Sitemap = getCategoriesInUse().map((category) => ({
    url: `${siteUrl}/menu/${category.slug}`,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const dishRoutes: MetadataRoute.Sitemap = menuItems.map((item) => ({
    url: `${siteUrl}/plato/${item.slug}`,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const branchRoutes: MetadataRoute.Sitemap = branches
    .filter((branch) => branch.status === "active")
    .map((branch) => ({
      url: `${siteUrl}/sucursales/${branch.slug}`,
      changeFrequency: "monthly",
      priority: 0.6,
    }));

  return [...staticRoutes, ...categoryRoutes, ...dishRoutes, ...branchRoutes];
}
