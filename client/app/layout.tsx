import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Toaster } from "sonner"
import { QueryProvider } from "@/components/providers/query-provider"
import { PassphrasePromptProvider } from "@/components/providers/passphrase-prompt-provider"
import "./globals.css"

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" })
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" })

export const metadata: Metadata = {
  title: "Aether-OS — Zero-Knowledge Virtual Cloud Aggregator",
  description:
    "Operator console for Aether-OS. Provision volumes, monitor erasure-coded pipelines, and observe system health.",
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable} bg-background`} suppressHydrationWarning>
      <body className="font-sans antialiased bg-background text-foreground">
        <QueryProvider>
          <PassphrasePromptProvider>
            {children}
          </PassphrasePromptProvider>
        </QueryProvider>
        <Toaster richColors position="top-right" closeButton />
      </body>
    </html>
  )
}
