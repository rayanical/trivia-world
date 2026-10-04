import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
    images: {
        // Avatar endpoints are small preprocessed WebP images with their own caching.
        unoptimized: true,
    },
};

export default nextConfig;
