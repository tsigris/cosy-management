import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

// ΕΙΣΑΓΩΓΗ ΤΩΝ COMPONENTS
import { AuthLogic } from "../components/AuthLogic"; 
import BottomNav from "../components/BottomNav";
import { Toaster } from 'sonner'

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// 1. ΡΥΘΜΙΣΕΙΣ ΓΙΑ ΚΙΝΗΤΑ (Viewport) - Διατήρηση Notch & Zoom Fix
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#f8fafc",
};

// 2. METADATA ΓΙΑ IPHONE STANDALONE MODE
export const metadata: Metadata = {
  title: "Cosy App",
  description: "Διαχείριση Επιχείρησης",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Cosy App",
  },
  formatDetection: {
    telephone: false,
  },
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
          backgroundColor: '#f8fafc' 
        }}
      >
        {/* Ο "ΦΥΛΑΚΑΣ" ΤΟΥ AUTH */}
        <AuthLogic /> 

        {/* ΕΙΔΟΠΟΙΗΣΕΙΣ (TOASTER) */}
        <Toaster 
          richColors 
          position="top-center" 
          toastOptions={{
            style: { borderRadius: '15px', fontWeight: 'bold' },
          }}
        />
        
        {/* ΤΟ ΠΕΡΙΕΧΟΜΕΝΟ ΜΕ ΠΕΡΙΘΩΡΙΟ ΓΙΑ ΝΑ ΜΗΝ ΚΡΥΒΕΤΑΙ ΑΠΟ ΤΗΝ ΜΠΑΡΑ */}
        <div style={{ paddingBottom: '90px' }}>
          {children}
        </div>

        {/* Η ΚΑΤΩ ΜΠΑΡΑ ΠΛΟΗΓΗΣΗΣ */}
        <BottomNav />
      </body>
    </html>
  );
}