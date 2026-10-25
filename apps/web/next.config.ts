// Security headers and optional container build output for the web application.
import path from "node:path";
import type { NextConfig } from "next";
import { securityHeaders } from "./src/lib/security-headers";

const nextConfig: NextConfig = {
  experimental: { cpus: 1 },
  // The container image sets NEXT_OUTPUT=standalone; local `next start` keeps the default output.
  ...(process.env.NEXT_OUTPUT === "standalone"
    ? { output: "standalone" as const, outputFileTracingRoot: path.join(__dirname, "../..") }
    : {}),
  async headers() {
    return [{
      source: "/:path*",
      headers: securityHeaders(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NODE_ENV === "development"),
    }];
  },
};

export default nextConfig;
