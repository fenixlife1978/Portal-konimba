// src/app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { FirebaseProvider, AuthUserProvider } from "@/firebase/provider";
import { PT_Sans } from "next/font/google";

const ptSans = PT_Sans({
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Portal | Konimba Group Marketing",
  description: "A portal for admins and publishers.",
  icons: {
    icon: "/favicon-new.png",
  },
  openGraph: {
    title: "Portal | Konimba Group Marketing",
    description: "Accede al portal de Konimba con toda la información y servicios.",
    url: "https://portal-konimba.vercel.app/",
    siteName: "Konimba Group Marketing",
    images: [
      {
        url: "https://portal-konimba.vercel.app/favicon-new.png", // logo en /public/favicon-new.png
        width: 600,
        height: 600,
        alt: "Konimba Logo",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Portal | Konimba Group Marketing",
    description: "Accede al portal de Konimba con toda la información y servicios.",
    images: ["https://portal-konimba.vercel.app/favicon-new.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${ptSans.className} font-body antialiased`}>
        <FirebaseProvider>
          <AuthUserProvider>
            {children}
          </AuthUserProvider>
        </FirebaseProvider>
        <Toaster />
      </body>
    </html>
  );
}
