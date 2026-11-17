import type { NextConfig } from 'next';

const config: NextConfig = {
  output: 'export', // plain HTML/CSS/JS in out/, hostable anywhere (S3 + CloudFront, GitHub Pages, ...)
  trailingSlash: true,
  images: { unoptimized: true },
  // `next dev` only: lets a phone or another computer on the home network open the dev server by IP
  allowedDevOrigins: ['192.168.*.*', '10.*.*.*'],
};

export default config;
