import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthLogic } from "@/components/AuthLogic"; 
import BottomNav from "@/components/BottomNav"; // Βεβαιώσου ότι υπάρχει αυτό το component
import { Toaster } from 'sonner';
import { Suspense } from 'react';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// 1. ΡΥΘΜΙΣΕΙΣ VIEWPORT (ΓΙΑ ΝΑ ΜΗΝ ΧΑΛΑΕΙ ΣΤΟ CHROME MOBILE)
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false, // Απαγορεύει το zoom (σημαντικό για app feel)
  viewportFit: "cover", // Γεμίζει την οθόνη (ακόμα και κάτω από το notch του iPhone)
  themeColor: "#f8fafc",
  // Αυτό είναι το μυστικό για να μην κρύβεται το keyboard/input στο Chrome Android:
  interactiveWidget: "resizes-content", 
};

// 2. ΡΥΘΜΙΣΕΙΣ METADATA (ΤΙΤΛΟΣ, PWA)
export const metadata: Metadata = {
  title: "Cosy App",
  description: "ERP Διαχείριση Επιχείρησης",
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
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        style={{
          margin: 0,
          padding: 0,
          backgroundColor: '#f8fafc',
          // Χρησιμοποιούμε dvh (dynamic viewport height) για να πιάνει σωστά το ύψος σε κινητά
          minHeight: '100dvh', 
          overscrollBehavior: 'none', // Απαγορεύει το "elastic scrolling" (τέντωμα) της σελίδας
        }}
      >
        <Suspense fallback={null}>
          {/* 1. Λογική Αυθεντικοποίησης (έλεγχος login) */}
          <AuthLogic />
          
          {/* 2. Notifications (Toast messages) */}
          <Toaster richColors position="top-center" />
          
          {/* 3. Κυρίως Περιεχόμενο */}
          {/* Προσθέτουμε padding-bottom για να μην κρύβεται τίποτα πίσω από το κάτω μενού */}
          <main style={{ paddingBottom: '90px', minHeight: '100dvh' }}>
            {children}
          </main>

          {/* 4. Κάτω Μενού Πλοήγησης (εμφανίζεται μόνο αν είσαι logged in) */}
          <BottomNav />
        </Suspense>
      </body>
    </html>
  );
}