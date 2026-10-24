import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: [
    "@prisma/client",
    "prisma",
    "sharp",
    "@react-pdf/renderer",
    "@react-pdf/pdfkit",
    "pdfkit",
  ],
  outputFileTracingIncludes: {
    "/*": [
      "./node_modules/.prisma/**/*",
      "./node_modules/sharp/**/*",
      "./node_modules/@img/**/*",
      "./node_modules/@react-pdf/**/*",
      "./node_modules/pdfkit/**/*",
      "./public/fonts/**/*",
    ],
  },
  async headers() {
    return [
      {
        source: "/api/public/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Accept" },
        ],
      },
    ];
  },
};

export default nextConfig;
