import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Imagen Docker liviana: Next arma .next/standalone con su propio server.js.
  output: "standalone",
  poweredByHeader: false,
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
};

export default nextConfig;
