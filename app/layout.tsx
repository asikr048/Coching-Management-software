import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import { Toaster } from "sonner"
import ConnectivityBanner from "@/components/desktop/ConnectivityBanner"
import { BrandingProvider } from "@/components/providers/BrandingContext"
import { LanguageProvider } from "@/components/providers/LanguageContext"
import LanguageSelector from "@/components/ui/LanguageSelector"

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] })
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] })

export const metadata: Metadata = {
  title: "MIIS ACADEMY - Coaching Management System",
  description: "Complete coaching center management solution with biometric attendance, fee management, course marketplace and more.",
  icons: {
    icon: [
      { url: "/icon.png", type: "image/png" },
      { url: "/favicon.ico" },
    ],
    apple: [
      { url: "/icon.png" },
    ],
    shortcut: "/favicon.ico",
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <BrandingProvider>
          <LanguageProvider>
            <ConnectivityBanner />
            {children}
            <LanguageSelector variant="floating" />
            <Toaster richColors position="top-right" />
          </LanguageProvider>
        </BrandingProvider>
      </body>
    </html>
  )
}
