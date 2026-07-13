import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/env/client";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/checkout",
          "/carrito",
          "/pedido/",
          "/api/",
          "/favoritos",
          "/visual-lab",
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
