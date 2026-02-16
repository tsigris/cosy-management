import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { AuthLogic } from "@/components/AuthLogic"; 
import BottomNav from "@/components/BottomNav";
import { Toaster } from 'sonner';
import { Suspense } from 'react';

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

// Ρυθμίσεις για να μοιάζει με App σε κινητά (χωρίς zoom, full screen)
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#f8fafc",
};

export const metadata: Metadata = {
  title: "Cosy App",
  description: "ERP Διαχείριση Επιχείρησης",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Cosy App" },
  formatDetection: { telephone: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="el">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        style={{ 
          overscrollBehavior: 'none', 
          backgroundColor: '#f8fafc',
          minHeight: '100dvh' 
        }}
      >
        <Suspense fallback={<div style={{padding: '50px', textAlign: 'center', color:'#64748b'}}>Φόρτωση εφαρμογής...</div>}>
          {/* 1. Λογική Ασφαλείας (Τρέχει παντού) */}
          <AuthLogic /> 
          
          {/* 2. Notifications */}
          <Toaster richColors position="top-center" />
          
          {/* 3. Κυρίως Περιεχόμενο */}
          <main style={{ paddingBottom: '90px' }}> 
            {children}
          </main>

          {/* 4. Κάτω Μενού Πλοήγησης */}
          <BottomNav />
        </Suspense>
      </body>
    </html>
  );
}