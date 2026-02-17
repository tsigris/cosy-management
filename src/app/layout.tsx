import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthLogic } from "@/components/AuthLogic"; 
import BottomNav from "@/components/BottomNav";
import { Toaster } from 'sonner';
import { Suspense } from 'react';

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#f8fafc",
  interactiveWidget: "resizes-content", 
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
        <script
          dangerouslySetInnerHTML={{
            __html: `
              function setVH() {
                let vh = window.innerHeight * 0.01;
                document.documentElement.style.setProperty('--vh', vh + 'px');
              }
              setVH();
              window.addEventListener('resize', setVH);
              window.addEventListener('orientationchange', setVH);
            `,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        style={{
          margin: 0,
          padding: 0,
          backgroundColor: '#f8fafc',
          minHeight: '100vh',
          /* ΔΙΟΡΘΩΣΗ: Χρησιμοποιούμε block για να λειτουργήσει το mouse scroll στο PC */
          display: 'block', 
          overflowY: 'auto',
          overflowX: 'hidden'
        }}
      >
        <Suspense fallback={null}>
          <AuthLogic />
          <Toaster richColors position="top-center" />
          
          <main 
            style={{ 
              width: '100%',
              minHeight: '100vh',
              paddingBottom: '100px', 
              position: 'relative',
              display: 'block'
            }}
          >
            {children}
          </main>

          <BottomNav />
        </Suspense>
      </body>
    </html>
  );
}