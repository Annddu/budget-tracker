import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import fs from "fs/promises";
import { createReadStream, existsSync } from "fs";
import path from "path";
import { getFullPath } from "@/lib/server/fileSystem";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get the file ID from the URL parameters
    const fileId = params.id;
    
    // Authenticate user
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Find the file in the database
    const fileRecord = await prisma.fileUpload.findUnique({
      where: { id: fileId }
    });
    
    // Check if file exists
    if (!fileRecord) {
      return NextResponse.json({ error: "File not found in database" }, { status: 404 });
    }
    
    // Verify the user owns this file
    if (fileRecord.userId !== user.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    
    // Get the absolute file path
    const absoluteFilePath = getFullPath(fileRecord.filePath);
    
    console.log('Download request details:', {
      fileId,
      userId: user.id,
      fileName: fileRecord.fileName,
      originalName: fileRecord.originalName,
      isComplete: fileRecord.isComplete,
      chunks: fileRecord.chunks,
      totalChunks: fileRecord.totalChunks,
      filePath: fileRecord.filePath,
      absoluteFilePath
    });
    
    // Check if file exists on disk
    if (!existsSync(absoluteFilePath)) {
      console.error('File not found on disk:', absoluteFilePath);
      return NextResponse.json({ error: "File not found on server" }, { status: 404 });
    }
    
    // Update download count
    await prisma.fileUpload.update({
      where: { id: fileId },
      data: {
        downloadCount: {
          increment: 1
        }
      }
    });
    
    // Get file stats for content length
    const stats = await fs.stat(absoluteFilePath);
    
    // Set response headers
    const headers = new Headers();
    headers.set('Content-Disposition', `attachment; filename=${encodeURIComponent(fileRecord.originalName)}`);
    headers.set('Content-Type', fileRecord.fileType || 'application/octet-stream');
    headers.set('Content-Length', stats.size.toString());
    
    // Create a response with the file stream
    const fileStream = createReadStream(absoluteFilePath);
    
    return new Response(fileStream as any, {
      headers,
      status: 200,
    });
  } catch (error) {
    console.error("Download error:", error);
    return NextResponse.json(
      { error: "Failed to download file" },
      { status: 500 }
    );
  }
}