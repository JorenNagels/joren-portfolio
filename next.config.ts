import type { NextConfig } from 'next';

const config: NextConfig = {
  output: 'export', // plain HTML/CSS/JS in out/, hostable anywhere (S3 + CloudFront, GitHub Pages, ...)
  trailingSlash: true,
  images: { unoptimized: true },
};

export default config;
