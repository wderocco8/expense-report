import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "9000", // MinIO
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "*.amazonaws.com", // S3
      },
    ],
  },
};

export default nextConfig;
