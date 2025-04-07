import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import fs from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { getFullPath } from "@/lib/server/fileSystem";

export async function GET(
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
    const fileRecord = await prisma.fileUpload.findUnique({
      where: { id: fileId }
    });
    
    if (!fileRecord) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }
    
    // Check ownership
    if (fileRecord.userId !== user.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    
    // Make sure file isn't already complete
    if (fileRecord.isComplete) {
      return NextResponse.json({ message: "File is already complete" });
    }
    
    // Check if chunks directory exists
    const chunksDir = path.join(
      path.dirname(getFullPath(fileRecord.filePath)),
      `${fileRecord.fileName}_chunks`
    );
    
    if (!existsSync(chunksDir)) {
      return NextResponse.json({ error: "Chunks directory not found" }, { status: 404 });
    }
    
    // Create final file path
    const finalFilePath = getFullPath(fileRecord.filePath);
    
    // Create write stream for final file
    const writeStream = require('fs').createWriteStream(finalFilePath);
    
    console.log(`Merging available chunks for file ${fileId}`);
    let mergedChunks = 0;
    
    try {
      // Merge all available chunks
      for (let i = 0; i < fileRecord.totalChunks; i++) {
        const chunkPath = path.join(chunksDir, `chunk_${i}`);
        
        if (existsSync(chunkPath)) {
          try {
            const chunkData = await fs.readFile(chunkPath);
            writeStream.write(chunkData);
            console.log(`Added chunk ${i} to final file`);
            mergedChunks++;
          } catch (chunkError) {
            console.error(`Error processing chunk ${i}:`, chunkError);
            // Continue with other chunks instead of failing
          }
        } else {
          console.log(`Missing chunk ${i}, skipping`);
        }
      }
      
      // End the stream
      writeStream.end();
      
      // Wait for completion
      await new Promise((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });
      
      // Mark as complete
      await prisma.fileUpload.update({
        where: { id: fileId },
        data: {
          isComplete: true,
          chunks: fileRecord.totalChunks
        }
      });
      
      return NextResponse.json({
        success: true,
        message: `File has been completed using ${mergedChunks}/${fileRecord.totalChunks} chunks`
      });
    } catch (error) {
      console.error("Error merging chunks:", error);
      return NextResponse.json({ error: "Failed to merge chunks" }, { status: 500 });
    }
  } catch (error) {
    console.error("Error completing file:", error);
    return NextResponse.json(
      { error: "Failed to complete file" },
      { status: 500 }
    );
  }
}