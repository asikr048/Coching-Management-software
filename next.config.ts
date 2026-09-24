import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/dashboard/super_manager",
        destination: "/dashboard/owner",
        permanent: false,
      },
      {
        source: "/dashboard/super_manager/:path*",
        destination: "/dashboard/owner/:path*",
        permanent: false,
      },
      {
        source: "/dashboard/manager",
        destination: "/dashboard/owner",
        permanent: false,
      },
      {
        source: "/dashboard/manager/:path*",
        destination: "/dashboard/owner/:path*",
        permanent: false,
      },
      {
        source: "/dashboard/branch_director",
        destination: "/dashboard/owner",
        permanent: false,
      },
      {
        source: "/dashboard/branch_director/:path*",
        destination: "/dashboard/owner/:path*",
        permanent: false,
      },
      {
        source: "/dashboard/receptionist",
        destination: "/dashboard/reception",
        permanent: false,
      },
      {
        source: "/dashboard/receptionist/:path*",
        destination: "/dashboard/reception/:path*",
        permanent: false,
      },
      {
        source: "/dashboard/student",
        destination: "/student/profile",
        permanent: false,
      },
      {
        source: "/dashboard/student/:path*",
        destination: "/student/profile",
        permanent: false,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/online_result",
        destination: "/online-result",
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
