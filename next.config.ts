import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Links from the earlier single-flow version still work.
  async redirects() {
    return [
      { source: "/report", has: [{ type: "query", key: "intent", value: "lost" }], destination: "/lost", permanent: false },
      { source: "/report", has: [{ type: "query", key: "intent", value: "found" }], destination: "/found", permanent: false },
      { source: "/report", destination: "/fix", permanent: false },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(self), geolocation=(self), microphone=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
