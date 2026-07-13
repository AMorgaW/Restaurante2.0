import type { MetadataRoute } from "next";
import { restaurantConfig } from "@/config/restaurant";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${restaurantConfig.name} — ${restaurantConfig.tagline}`,
    short_name: restaurantConfig.shortName,
    description: restaurantConfig.description,
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#020118",
    theme_color: "#020118",
    lang: "es",
    categories: ["food", "restaurants", "shopping"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
