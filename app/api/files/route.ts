import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    // Auth check
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Get category filter from query params
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    
    console.log(`Fetching files for userId=${user.id}, category=${category || 'all'}`);
    
    // Get files from database - don't filter by isComplete to see all files
    const files = await prisma.fileUpload.findMany({
      where: {
        userId: user.id,
        ...(category && category !== "all" ? { category } : {})
        // Removed isComplete filter to see all files
      },
      orderBy: {
        uploadedAt: "desc"
      }
    });
    
    console.log(`Found ${files.length} files`);
    
    // Format the response
    const formattedFiles = files.map(file => ({
      ...file,
      fileSize: file.fileSize.toString(), // Convert BigInt to string for JSON
      // Add debug info
      chunksInfo: `${file.chunks}/${file.totalChunks} chunks`
    }));
    
    return NextResponse.json({ files: formattedFiles });
  } catch (error) {
    console.error("Error fetching files:", error);
    return NextResponse.json(
      { error: "Failed to fetch files" },
      { status: 500 }
    );
  }
}