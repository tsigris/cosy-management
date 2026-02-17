import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { AuthLogic } from "../components/AuthLogic"; 
import BottomNav from "../components/BottomNav";
import { Toaster } from 'sonner';

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
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        style={{ overscrollBehavior: 'none', backgroundColor: '#f8fafc' }}
      >
        <AuthLogic /> 
        <Toaster richColors position="top-center" />
        
        {/* Ενεργοποιούμε ξανά τα components. 
            Η λογική "πότε κρύβονται" βρίσκεται πλέον μέσα σε αυτά. */}
        <main>
          {children}
        </main>

        <BottomNav />
      </body>
    </html>
  );
}