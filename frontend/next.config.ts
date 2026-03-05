import type { NextConfig } from "next";

const isStaticExport = process.env.NEXT_OUTPUT === "export";

const nextConfig: NextConfig = {
  ...(isStaticExport ? { output: "export" } : {}),
  trailingSlash: true,
  ...(!isStaticExport && {
    async rewrites() {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      if (!apiUrl) return [];
      return [
        { source: "/api/:path*", destination: `${apiUrl}/api/:path*` },
      ];
    },
  }),
};

export default nextConfig;
