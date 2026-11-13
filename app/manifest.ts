import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LançaNota",
    short_name: "LançaNota",
    description: "Lance notas de compra no Google Sheets",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f7f9",
    theme_color: "#0f766e",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
