/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "coodelsursas.com.co",
      },
    ],
  },
};

module.exports = nextConfig;
