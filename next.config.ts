import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Old routes from the first version still work.
  async redirects() {
    return [
      { source: "/lost", destination: "/report?intent=lost", permanent: false },
      { source: "/found", destination: "/report?intent=found", permanent: false },
      { source: "/fix", destination: "/report?intent=issue", permanent: false },
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
