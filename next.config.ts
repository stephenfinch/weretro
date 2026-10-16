import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg", "ws", "exceljs", "nodemailer", "@node-saml/node-saml"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  images: { unoptimized: true },
  // OAuth discovery documents for MCP clients (RFC 8414 / RFC 9728).
  async rewrites() {
    return [
      { source: "/.well-known/oauth-authorization-server/:path*", destination: "/api/oauth/metadata" },
      { source: "/.well-known/oauth-authorization-server", destination: "/api/oauth/metadata" },
      { source: "/.well-known/openid-configuration", destination: "/api/oauth/metadata" },
      { source: "/.well-known/oauth-protected-resource/:path*", destination: "/api/oauth/resource" },
      { source: "/.well-known/oauth-protected-resource", destination: "/api/oauth/resource" },
    ];
  },
};

export default nextConfig;
