import type { MetadataRoute } from "next";
/** Static on purpose: the web app manifest must not depend on the API being up. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Queen Luxury Hair",
    short_name: "Queen Luxury Hair",
    description: "Hair and beauty from Queen Luxury Hair, Ilesha.",
    start_url: "/",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#000000",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
