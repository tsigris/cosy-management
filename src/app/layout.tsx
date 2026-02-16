import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { AuthLogic } from "../components/AuthLogic"; 
import BottomNav from "../components/BottomNav";
import { Toaster } from 'sonner';
import { Suspense } from 'react'; // Απαραίτητο για τα searchParams

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

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
  description: "Διαχείριση Επιχείρησης",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Cosy App" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="el">
      <head>
        {/* Meta tags για σωστή εμφάνιση σε iPhone/Android ως App */}
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
        {/* Το Suspense επιτρέπει στα AuthLogic και BottomNav να διαβάζουν 
          σωστά το ?store=ID από το URL χωρίς να μπερδεύονται 
        */}
        <Suspense fallback={<div style={{padding: '20px', textAlign: 'center'}}>Φορτώνει...</div>}>
          <AuthLogic /> 
          <Toaster richColors position="top-center" />
          
          <main style={{ paddingBottom: '80px' }}> {/* Padding για να μη κρύβεται το περιεχόμενο πίσω από το Nav */}
            {children}
          </main>

          <BottomNav />
        </Suspense>
      </body>
    </html>
  );
}