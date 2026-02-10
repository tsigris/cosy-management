import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

// ΕΙΣΑΓΩΓΗ ΤΟΥ ΣΩΣΤΟΥ ΑΡΧΕΙΟΥ (Χρησιμοποιούμε ../ για σιγουριά)
import { AuthLogic } from "../components/AuthLogic"; 

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
        style={{ overscrollBehavior: 'none' }} // Αποτρέπει το "pull-to-refresh" που κολλάει το app
      >
        {/* Ο "ΦΥΛΑΚΑΣ" ΠΟΥ ΚΡΑΤΑΕΙ ΤΟ APP ONLINE ΧΩΡΙΣ ΚΟΛΛΗΜΑΤΑ */}
        <AuthLogic /> 
        
        {children}
      </body>
    </html>
  );
}