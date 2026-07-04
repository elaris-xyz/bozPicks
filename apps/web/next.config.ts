import type { NextConfig } from 'next';

const config: NextConfig = {
  // NEXT_DIST_DIR lets dev use an alternate build dir when .next is locked
  // by a stale process (Windows); production builds keep the default.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  transpilePackages: ['@bozpicks/shared', '@bozpicks/txline-client'],
  serverExternalPackages: ['ioredis', 'pg'],

  async rewrites() {
    const agentDomain = process.env.AGENT_DOMAIN || 'agent.bozpicks.com';
    const settleDomain = process.env.SETTLE_DOMAIN || 'settle.bozpicks.com';

    return {
      afterFiles: [],
      fallback: [],
      beforeFiles: [
        // agent.bozpicks.com → /agent
        {
          source: '/:path*',
          has: [{ type: 'host', value: agentDomain }],
          destination: '/agent/:path*',
        },
        // settle.bozpicks.com → /settle
        {
          source: '/:path*',
          has: [{ type: 'host', value: settleDomain }],
          destination: '/settle/:path*',
        },
      ],
    };
  },
};

export default config;
