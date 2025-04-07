import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import fs from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { createFilePath } from "@/lib/fileStorage";
import { ensureDir, getFullPath } from "@/lib/server/fileSystem";

export async function POST(request: Request) {
  try {
    // Auth check
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse the form data from the request
    const formData = await request.formData();
    
    // Get chunk metadata
    const fileId = formData.get("fileId") as string;
    const chunkIndex = parseInt(formData.get("chunkIndex") as string);
    const totalChunks = parseInt(formData.get("totalChunks") as string);
    const chunkData = formData.get("chunk") as File;
    
    // For first chunk, initialize the file record
    if (chunkIndex === 0) {
      const fileName = formData.get("fileName") as string;
      const fileType = formData.get("fileType") as string;
      const fileSize = parseInt(formData.get("fileSize") as string);
      const category = formData.get("category") as string || "general";
      const description = formData.get("description") as string || "";
      
      // Create the file path and ensure the directory exists
      const { dirPath, filePath, uniqueFileName } = createFilePath(
        user.id, 
        fileName, 
        category
      );
      
      await ensureDir(dirPath);
      
      // Create temporary chunks directory
      const chunksDir = path.join(dirPath, `${uniqueFileName}_chunks`);
      await ensureDir(chunksDir);
      
      // Create the file record
      const fileUpload = await prisma.fileUpload.create({
        data: {
          userId: user.id,
          fileName: uniqueFileName,
          originalName: fileName,
          fileSize: BigInt(fileSize),
          fileType: fileType,
          filePath: filePath,
          category: category,
          description: description,
          isComplete: false,
          chunks: 0,
          totalChunks: totalChunks
        }
      });
      
      // Return the file ID for subsequent chunk uploads
      return NextResponse.json({
        success: true,
        fileId: fileUpload.id,
        chunksDir
      });
    }
    
    // For subsequent chunks, add to existing file
    if (!fileId) {
      return NextResponse.json({ error: "Missing fileId" }, { status: 400 });
    }
    
    // Get the file record
    const fileUpload = await prisma.fileUpload.findUnique({
      where: { id: fileId }
    });
    
    if (!fileUpload) {
      return NextResponse.json({ error: "File record not found" }, { status: 404 });
    }
    
    // Verify the user owns this file
    if (fileUpload.userId !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Get directory for chunks
    const chunksDir = path.join(
      path.dirname(fileUpload.filePath),
      `${fileUpload.fileName}_chunks`
    );
    
    // Ensure the chunks directory exists
    await ensureDir(chunksDir);
    
    // Write the chunk to a temporary file
    const chunkPath = path.join(chunksDir, `chunk_${chunkIndex}`);
    try {
      // Get absolute path for the chunk
      const absoluteChunkPath = getFullPath(chunkPath);
      
      // Log for debugging
      console.log(`Writing chunk ${chunkIndex}/${totalChunks} to: ${absoluteChunkPath}`);
      
      const arrayBuffer = await chunkData.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Add timeout handling for file operations
      const writeFileWithTimeout = async (path: string, data: Buffer, timeoutMs = 30000) => {
        return Promise.race([
          fs.writeFile(path, data),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error("Write operation timed out")), timeoutMs)
          )
        ]);
      };
      
      // Use the timeout version for file operations
      await writeFileWithTimeout(absoluteChunkPath, buffer);
    } catch (chunkError: unknown) {
      console.error(`Error writing chunk ${chunkIndex}:`, chunkError);
      const errorMessage = chunkError instanceof Error ? chunkError.message : String(chunkError);
      return NextResponse.json({ 
        error: `Chunk ${chunkIndex} write failed: ${errorMessage}` 
      }, { status: 500 });
    }
    
    // Update the file record to track progress
    await prisma.fileUpload.update({
      where: { id: fileId },
      data: {
        chunks: {
          increment: 1
        }
      }
    });
    
    // If this is the last chunk, merge all chunks into the final file
    const updatedFile = await prisma.fileUpload.findUnique({
      where: { id: fileId }
    });
    
    if (updatedFile && updatedFile.chunks === updatedFile.totalChunks) {
      // Create the final file by merging all chunks
      const finalFilePath = getFullPath(updatedFile.filePath);
      
      try {
        console.log(`Merging ${updatedFile.totalChunks} chunks into ${finalFilePath}`);
        
        // Use streaming for memory efficiency
        const { createWriteStream, createReadStream } = require('fs');
        const writeStream = createWriteStream(finalFilePath);
        
        // Process chunks one by one using streams
        for (let i = 0; i < updatedFile.totalChunks; i++) {
          const chunkPath = path.join(chunksDir, `chunk_${i}`);
          
          // Check if chunk exists
          if (!existsSync(getFullPath(chunkPath))) {
            console.error(`Missing chunk ${i}/${updatedFile.totalChunks}`);
            
            // Instead of throwing an error, just continue with available chunks
            continue;
          }
          
          // Use streaming instead of loading entire chunk into memory
          await new Promise((resolve, reject) => {
            const readStream = createReadStream(getFullPath(chunkPath));
            readStream.pipe(writeStream, { end: false });
            readStream.on('end', resolve);
            readStream.on('error', reject);
          });
        }
        
        // Close the write stream
        writeStream.end();
        
        // Wait for completion
        await new Promise((resolve, reject) => {
          writeStream.on('finish', resolve);
          writeStream.on('error', reject);
        });
        
        // Mark the file as complete in the database
        await prisma.fileUpload.update({
          where: { id: fileId },
          data: {
            isComplete: true
          }
        });
        
        // Verify the file was created
        if (!existsSync(finalFilePath)) {
          throw new Error("Failed to create merged file");
        }
        
        console.log(`Successfully merged chunks into ${finalFilePath}`);
        
        // Cleanup the temporary chunk files
        for (let i = 0; i < updatedFile.totalChunks; i++) {
          const chunkPath = path.join(chunksDir, `chunk_${i}`);
          await fs.unlink(chunkPath);
        }
        await fs.rmdir(chunksDir);
        
        return NextResponse.json({
          success: true,
          fileId: fileId,
          isComplete: true,
          fileName: updatedFile.originalName
        });
      } catch (error) {
        console.error("Error merging chunks:", error);
        throw error;
      }
    }
    
    return NextResponse.json({
      success: true,
      fileId: fileId,
      chunkIndex: chunkIndex,
      chunksProcessed: updatedFile?.chunks || 0,
      totalChunks: updatedFile?.totalChunks || 0
    });
  } catch (error) {
    console.error("Chunk upload error:", error);
    
    // Provide more detailed error information
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : "Unknown error",
      code: error instanceof Error ? error.name : "UnknownError"
    }, { status: 500 });
  }
}