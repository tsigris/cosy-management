import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AuthGuardian from "@/components/AuthGuardian"; // Θα το φτιάξουμε αμέσως μετά ή θα το βάλουμε εσωτερικά

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

// 2. METADATA ΓΙΑ IPHONE STANDALONE MODE - Διατήρηση
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

// --- CLIENT COMPONENT ΓΙΑ ΤΟΝ ΑΥΤΟΜΑΤΙΣΜΟ (Ενσωματωμένο) ---
// Αυτό το κομμάτι τρέχει στο παρασκήνιο και "φυλάει" την εφαρμογή σε κάθε σελίδα
import { AuthLogic } from "@/components/AuthLogic"; 

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
        style={{ overscrollBehavior: 'none' }} // Αποτρέπει το κόλλημα από το τράβηγμα
      >
        {/* Ο "ΦΥΛΑΚΑΣ" ΤΗΣ ΕΦΑΡΜΟΓΗΣ */}
        <AuthLogic /> 
        
        {children}
      </body>
    </html>
  );
}

// --- ΔΗΜΙΟΥΡΓΙΑ ΤΟΥ AUTH LOGIC ΣΤΟ ΙΔΙΟ ΑΡΧΕΙΟ Η ΣΕ ΞΕΧΩΡΙΣΤΟ ---
// Για ευκολία, μπορείς να δημιουργήσεις ένα αρχείο: app/components/AuthLogic.tsx