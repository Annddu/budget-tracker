import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import fs from "fs/promises";
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
    
    // Get metadata from the request
    const file = formData.get("file") as File;
    const category = formData.get("category") as string || "general";
    const description = formData.get("description") as string || "";
    
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    
    // Get file details
    const fileName = file.name;
    const fileType = file.type;
    const fileSize = file.size;
    
    // Create the file path and ensure the directory exists
    const { dirPath, filePath, uniqueFileName } = createFilePath(
      user.id, 
      fileName, 
      category
    );
    
    // Get the absolute paths for directory and file
    const absoluteDirPath = await ensureDir(dirPath);
    const absoluteFilePath = getFullPath(filePath);
    
    // Convert the file to an ArrayBuffer and then to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Write the file to disk using the absolute path
    await fs.writeFile(absoluteFilePath, buffer);
    
    // Save the file information to the database
    const fileUpload = await prisma.fileUpload.create({
      data: {
        userId: user.id,
        fileName: uniqueFileName,
        originalName: fileName,
        fileSize: BigInt(fileSize),
        fileType: fileType,
        filePath: filePath, // Store only the relative path!
        category: category,
        description: description,
        isComplete: true
      }
    });
    
    return NextResponse.json({
      success: true,
      fileId: fileUpload.id,
      fileName: fileUpload.originalName
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500 }
    );
  }
}