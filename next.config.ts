import type { NextConfig } from "next";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
const isProduction = process.env.NODE_ENV === "production";

function getConfiguredApiOrigin() {
  if (!apiBaseUrl) {
    return null;
  }

  try {
    return new URL(apiBaseUrl).origin;
  } catch {
    return null;
  }
}

const apiOrigin = getConfiguredApiOrigin();
const connectSources = new Set(["'self'"]);

if (apiOrigin) {
  connectSources.add(apiOrigin);

  const apiUrl = new URL(apiOrigin);
  if (apiUrl.protocol === "http:" || apiUrl.protocol === "https:") {
    const socketProtocol = apiUrl.protocol === "https:" ? "wss:" : "ws:";
    connectSources.add(`${socketProtocol}//${apiUrl.host}`);
  }
}

if (!isProduction) {
  [
    "http://localhost:8080",
    "http://127.0.0.1:8080",
    "ws://localhost:8080",
    "ws://127.0.0.1:8080",
  ].forEach((source) => connectSources.add(source));
}

const mediaSources = ["'self'", "blob:", ...(apiOrigin ? [apiOrigin] : [])];
const imageSources = [
  "'self'",
  "data:",
  "blob:",
  "https://images.unsplash.com",
  ...(apiOrigin ? [apiOrigin] : []),
];

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  `script-src 'self' 'unsafe-inline'${isProduction ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src ${imageSources.join(" ")}`,
  `media-src ${mediaSources.join(" ")}`,
  "font-src 'self' data:",
  `connect-src ${Array.from(connectSources).join(" ")}`,
  "manifest-src 'self'",
  "worker-src 'self' blob:",
  ...(isProduction ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  ...(isProduction
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
    ],
  },
  async rewrites() {
    if (!apiBaseUrl) {
      return [];
    }

    return [
      {
        source: "/uploads/:path*",
        destination: `${apiBaseUrl}/uploads/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/",
        destination: "/login",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
