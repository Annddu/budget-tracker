import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import FileUpload from "../_components/FileUpload";
import FilesList from "../_components/FilesList";

export default function FilesPage() {
  return (
    <div className="px-8 py-8 w-full ">
      <h1 className="text-3xl font-bold mb-8">File Management</h1>
      
      <Tabs defaultValue="files" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="files">My Files</TabsTrigger>
          <TabsTrigger value="upload">Upload File</TabsTrigger>
        </TabsList>
        
        <TabsContent value="files" className="w-full">
          <FilesList />
        </TabsContent>
        
        <TabsContent value="upload" className="w-full">
          <FileUpload />
        </TabsContent>
      </Tabs>
    </div>
  );
}