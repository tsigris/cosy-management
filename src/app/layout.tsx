import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// 1. ΡΥΘΜΙΣΕΙΣ ΓΙΑ ΚΙΝΗΤΑ (Viewport) - Λύνει το πρόβλημα του Zoom και του Notch
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover", // Γεμίζει όλη την οθόνη του iPhone (πάνω από το notch)
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
    telephone: false, // Αποτρέπει το αυτόματο μπλε χρώμα στους αριθμούς τηλεφώνου
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
        {/* Επιπλέον tags για την αρχική οθόνη του iPhone */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        style={{ overscrollBehavior: 'none' }} // Αποτρέπει το "τράβηγμα" προς τα κάτω που κολλάει το app
      >
        {children}
      </body>
    </html>
  );
}