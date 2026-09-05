import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import { Toaster } from "sonner"
import ConnectivityBanner from "@/components/desktop/ConnectivityBanner"

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] })
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] })

export const metadata: Metadata = {
  title: "MedhaShiree - Coaching Management System",
  description: "Complete coaching center management solution with biometric attendance, fee management, course marketplace and more.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ConnectivityBanner />
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  )
}
