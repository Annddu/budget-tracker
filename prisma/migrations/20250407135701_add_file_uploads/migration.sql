/*
  Warnings:

  - You are about to drop the column `isPublic` on the `FileUpload` table. All the data in the column will be lost.
  - You are about to drop the column `storagePath` on the `FileUpload` table. All the data in the column will be lost.
  - Added the required column `filePath` to the `FileUpload` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_FileUpload" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "fileSize" BIGINT NOT NULL,
    "fileType" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "category" TEXT NOT NULL DEFAULT 'general',
    "description" TEXT,
    "isComplete" BOOLEAN NOT NULL DEFAULT false,
    "chunks" INTEGER NOT NULL DEFAULT 0,
    "totalChunks" INTEGER NOT NULL DEFAULT 0,
    "downloadCount" INTEGER NOT NULL DEFAULT 0
);
INSERT INTO "new_FileUpload" ("category", "description", "downloadCount", "fileName", "fileSize", "fileType", "id", "originalName", "uploadedAt", "userId") SELECT "category", "description", "downloadCount", "fileName", "fileSize", "fileType", "id", "originalName", "uploadedAt", "userId" FROM "FileUpload";
DROP TABLE "FileUpload";
ALTER TABLE "new_FileUpload" RENAME TO "FileUpload";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
