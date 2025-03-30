import Navbar from '@/components/Navbar'
import React, { ReactNode } from 'react'
import { DemoProvider } from '../context/DemoContext'

function layout({children} : {children: ReactNode}) {
  return (
    <DemoProvider>
      <div className='relative flex h-screen w-full flex-col'>
          <Navbar />
          <div className='w-full'>{children}</div>
      </div>
    </DemoProvider>
  )
}

export default layout