import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  images: {
    // Fotos de pilotos (PROFILE, 3-4 MB): next/image las redimensiona. Solo se permite este host.
    remotePatterns: [
      { protocol: "https", hostname: "photos.motogp.com", pathname: "/**" },
    ],
  },
};
export default nextConfig;
