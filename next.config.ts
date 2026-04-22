import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
    ],
  },
  async redirects() {
    return [
      {
        source: "/",           // 유저가 맨 처음 (/) 접속하면
        destination: "/login",  // /login으로 보낸다
        permanent: true,       // 브라우저에 이 설정을 기억시킴
      },
    ];
  },
};

export default nextConfig;
