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
  interactiveWidget: "resizes-content", // Κρίσιμο για το πληκτρολόγιο Android
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
        {/* Το script που διορθώνει το ύψος στα Redmi Note */}
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
          minHeight: '100dvh', // Δυναμικό ύψος για κινητά
          overscrollBehavior: 'none', // Απαγορεύει το "τέντωμα" της σελίδας
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <Suspense fallback={null}>
          <AuthLogic />
          <Toaster richColors position="top-center" />
          
          {/* ΕΔΩ ΕΙΝΑΙ Η ΔΙΟΡΘΩΣΗ ΓΙΑ ΤΟ SCROLL ΜΕ ΕΝΑ ΔΑΧΤΥΛΟ:
            Αφαιρούμε το position: fixed και το overflow: hidden από το body.
          */}
          <main 
            style={{ 
              flex: 1,
              width: '100%',
              paddingBottom: '90px', // Χώρος για το BottomNav
              touchAction: 'pan-y', // Επιτρέπει το scroll πάνω-κάτω με ένα δάχτυλο
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