import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Відмітка — навчальний розклад",
    short_name: "Відмітка",
    description: "Актуальний навчальний розклад викладачів, груп і аудиторій.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#F5F2EB",
    theme_color: "#0F766E",
    lang: "uk",
    categories: ["education", "productivity"],
    icons: [
      { src: "/icon-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Розклад", short_name: "Розклад", url: "/", icons: [{ src: "/icon-192x192.png", sizes: "192x192" }] },
      { name: "Перенесення пар", short_name: "Перенесення", url: "/transfers", icons: [{ src: "/icon-192x192.png", sizes: "192x192" }] },
    ],
  };
}
