module.exports = {
  // Disable Fast Refresh during development to prevent upload interruptions
  webpack: (config) => {
    // Add ignore patterns for file uploads folder to prevent Fast Refresh
    config.watchOptions = {
      ignored: ['**/node_modules', '**/.next', '**/uploads/**'],
    };
    return config;
  },
  experimental: {
    serverComponentsExternalPackages: ['sharp'],
  },
  // Increase body size limit
  api: {
    bodyParser: {
      sizeLimit: '20mb',
    },
    responseLimit: false,
  }
}