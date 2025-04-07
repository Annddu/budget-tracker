import path from "path";

// Client-side configuration (safe to import in client components)
export const STORAGE_CONFIG = {
  // Base directory for all uploads - create uploads folder in project root
  baseDir: "/uploads", 
  
  // Size of each chunk for large files
  chunkSize: 15 * 1024 * 1024, // Increased to 15MB for better performance
  
  // Maximum chunks to avoid too many requests
  maxChunks: 5000
};

// Add a helper function to dynamically calculate optimal chunk size
export function getOptimalChunkSize(fileSize: number): number {
  const baseChunkSize = STORAGE_CONFIG.chunkSize;
  const maxChunks = STORAGE_CONFIG.maxChunks;
  
  // For very large files, increase chunk size to keep under maxChunks
  if (fileSize / baseChunkSize > maxChunks) {
    return Math.ceil(fileSize / maxChunks);
  }
  
  return baseChunkSize;
}

// This function will now just return path strings without using fs
export function createFilePath(userId: string, fileName: string, category: string) {
  // Sanitize filename to avoid path traversal
  const sanitizedFileName = fileName.replace(/[/\\?%*:|"<>]/g, '-');
  
  // Create unique filename with timestamp
  const uniqueFileName = `${Date.now()}-${sanitizedFileName}`;
  
  // Create user/category directory path as string only
  const userCategoryDir = `${category}/${userId}`;
  
  // Full file path
  const filePath = `${userCategoryDir}/${uniqueFileName}`;
  
  return {
    dirPath: userCategoryDir,
    filePath,
    uniqueFileName
  };
}