import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import { Toaster } from "sonner"
import ConnectivityBanner from "@/components/desktop/ConnectivityBanner"
import { BrandingProvider } from "@/components/providers/BrandingContext"
import { LanguageProvider } from "@/components/providers/LanguageContext"
import LanguageSelector from "@/components/ui/LanguageSelector"
import { getServerBranding } from "@/lib/branding-server"

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] })
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] })

export async function generateMetadata(): Promise<Metadata> {
  const branding = await getServerBranding()
  const iconUrl = branding.faviconUrl || branding.logoUrl || "/icon.png"
  const description =
    branding.tagline ||
    "Complete coaching center management solution with biometric attendance, fee management, course marketplace and more."

  return {
    title: `${branding.name} - Coaching Management System`,
    description,
    icons: {
      icon: [{ url: iconUrl }],
      apple: [{ url: iconUrl }],
      shortcut: iconUrl,
    },
  }
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
