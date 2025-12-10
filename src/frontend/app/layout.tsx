// src/frontend/app/layout.tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import '@/styles/globals.css' 

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Video Analysis Dashboard',
  description: 'Video analysis and processing tool',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body 
        className={`${inter.className} min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-100`}
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  )
}