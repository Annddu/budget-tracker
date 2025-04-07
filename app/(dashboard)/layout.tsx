import Navbar from '@/components/Navbar'
import React, { ReactNode } from 'react'
import { DemoProvider } from '../context/DemoContext'
import { FileUploadProvider } from './_context/FileUploadContext';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DemoProvider>
      <FileUploadProvider>
        <div className='relative flex h-screen w-full flex-col'>
          <Navbar />
          <div className='w-full'>{children}</div>
        </div>
      </FileUploadProvider>
    </DemoProvider>
  );
}