import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "HardwareHub Inventory & POS",
    short_name: "HardwareHub",
    description: "Hardware store inventory and point-of-sale system",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f8fb",
    theme_color: "#5b5ce2",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
