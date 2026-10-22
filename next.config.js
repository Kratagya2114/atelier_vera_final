/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // nodemailer must stay a Node-side dependency (not bundled into the edge/client)
  experimental: { serverComponentsExternalPackages: ['nodemailer'] },
};
module.exports = nextConfig;
