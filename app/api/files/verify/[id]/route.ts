import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { existsSync } from "fs";
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
    
    return NextResponse.json({
      id: fileRecord.id,
      isComplete: fileRecord.isComplete,
      chunks: fileRecord.chunks,
      totalChunks: fileRecord.totalChunks
    });
  } catch (error) {
    console.error("Error verifying file:", error);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}