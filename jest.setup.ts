// Add jest-dom matchers
require('@testing-library/jest-dom');

// Mock global objects if needed
global.Response = class {
  static json(data: any, init?: ResponseInit) {
    return new Response(JSON.stringify(data), init);
  }
} as unknown as typeof Response;