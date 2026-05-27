import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/shell/sidebar-nav"
import { Topbar } from "@/components/shell/topbar"
import { AlertBanner } from "@/components/shell/alert-banner"
import { SessionBootstrap } from "@/components/shell/session-bootstrap"

import { DownloadManager } from "@/components/browser/download-manager"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect("/login")

  // User data comes from the JWT session — no DB query needed
  const user = {
    id: session.sub,
    email: session.email,
    salt_b64: "",
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="flex flex-col min-w-0">
        <Topbar />
        <AlertBanner />
        <SessionBootstrap user={{ sub: user.id, email: user.email, salt_b64: user.salt_b64 }} />
        <main className="flex-1 p-4 md:p-6 min-w-0">{children}</main>
        <DownloadManager />
      </SidebarInset>
    </SidebarProvider>
  )
}
