import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["playwright", "playwright-core"],
  outputFileTracingIncludes: {
    "/*": ["./node_modules/playwright-core/.local-browsers/**/*"],
  },
};

export default nextConfig;
