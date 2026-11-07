import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  images: {
    // Fotos de pilotos (PROFILE, 3-4 MB): next/image las redimensiona. Solo en desarrollo y solo este host;
    // en producción la lista queda vacía para que /_next/image no sirva contenido oficial (ver aviso legal).
    remotePatterns:
      process.env.NODE_ENV === "production"
        ? []
        : [{ protocol: "https", hostname: "photos.motogp.com", pathname: "/**" }],
  },
};
export default nextConfig;
