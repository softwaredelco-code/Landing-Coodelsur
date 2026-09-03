/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "coodelsursas.com.co",
      },
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },
  async redirects() {
    return [
      {
        source: "/gracias",
        destination: "/solicitud-enviada",
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;
