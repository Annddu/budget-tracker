import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import fs from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { getFullPath } from "@/lib/server/fileSystem";

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const fileId = params.id;
    
    // Auth check
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Get file record
    const file = await prisma.fileUpload.findUnique({
      where: { id: fileId }
    });
    
    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }
    
    // Check ownership
    if (file.userId !== user.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    
    // Get the absolute file path
    const absoluteFilePath = getFullPath(file.filePath);
    console.log(`Attempting to delete file at: ${absoluteFilePath}`);
    
    // Delete file from filesystem if it exists
    if (existsSync(absoluteFilePath)) {
      await fs.unlink(absoluteFilePath);
      console.log(`Successfully deleted file: ${absoluteFilePath}`);
    } else {
      console.log(`File not found on disk: ${absoluteFilePath}`);
    }
    
    // Also check for chunks directory and clean it up if it exists
    const chunksDir = path.join(
      path.dirname(absoluteFilePath),
      `${file.fileName}_chunks`
    );
    
    if (existsSync(chunksDir)) {
      // Delete all chunk files first
      const chunkFiles = await fs.readdir(chunksDir);
      
      for (const chunkFile of chunkFiles) {
        await fs.unlink(path.join(chunksDir, chunkFile));
      }
      
      // Then remove the directory itself
      await fs.rmdir(chunksDir);
      console.log(`Successfully deleted chunks directory: ${chunksDir}`);
    }
    
    // Delete from database
    await prisma.fileUpload.delete({
      where: { id: fileId }
    });
    
    return NextResponse.json({ 
      success: true,
      message: "File deleted successfully" 
    });
  } catch (error) {
    console.error("Delete file error:", error);
    return NextResponse.json(
      { error: "Failed to delete file" },
      { status: 500 }
    );
  }
}