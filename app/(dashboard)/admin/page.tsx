import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import MonitoredUsersPage from "../_components/MonitoredUsersPage";

export default async function AdminPage() {
  // Check if user is authenticated and admin
  const user = await currentUser();
  
  if (!user) {
    redirect("/sign-in");
  }
  
  // Check for admin role in metadata
  if (user.publicMetadata?.role !== "admin") {
    redirect("/dashboard");
  }
  
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>
      <MonitoredUsersPage />
    </div>
  );
}