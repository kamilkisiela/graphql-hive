/* eslint-disable no-undef, no-process-env */
export default {
  basePath: process.env.NEXT_BASE_PATH,
  poweredByHeader: false,
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    newNextLinkBehavior: true,
  },
  images: {
    unoptimized: true,
  },
};
