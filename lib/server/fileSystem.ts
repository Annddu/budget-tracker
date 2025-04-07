import fs from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';

// Server-only configuration
const UPLOAD_DIR = path.join(process.cwd(), "uploads");

// Ensure uploads directory exists on first import
try {
  if (!existsSync(UPLOAD_DIR)) {
    mkdirSync(UPLOAD_DIR, { recursive: true });
    console.log('Created uploads directory:', UPLOAD_DIR);
  }
} catch (err) {
  console.error('Error creating uploads directory:', err);
}

// Server-only function to ensure directory exists
export async function ensureDir(dirPath: string) {
  const fullPath = path.join(UPLOAD_DIR, dirPath);
  
  if (!existsSync(fullPath)) {
    await fs.mkdir(fullPath, { recursive: true });
  }
  
  return fullPath;
}

// Get absolute path for a file
export function getFullPath(relativePath: string) {
  return path.join(UPLOAD_DIR, relativePath);
}