"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Activity, Boxes, Cloud, Cog, HardDrive, LayoutDashboard, Server, FlaskConical } from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/volumes", label: "Volumes", icon: HardDrive },
  { href: "/dashboard/volumes-testing", label: "Volumes (Testing)", icon: FlaskConical },
  { href: "/dashboard/providers", label: "Providers", icon: Cloud },
  { href: "/dashboard/workers", label: "Workers", icon: Server },
  { href: "/dashboard/observability", label: "Observability", icon: Activity },
  { href: "/dashboard/settings", label: "Settings", icon: Cog },
]

export function AppSidebar() {
  const pathname = usePathname()
  const isActive = (href: string) => (href === "/dashboard" ? pathname === "/dashboard" : pathname === href || pathname.startsWith(href + "/"))

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarHeader className="border-b">
        <div className="flex items-center gap-2 px-1.5 py-2">
          <div
            aria-hidden
            className="size-7 shrink-0 rounded-md bg-foreground text-background grid place-items-center font-mono text-xs font-bold"
          >
            Ae
          </div>
          <div className="flex flex-col leading-tight group-data-[collapsible=icon]:hidden">
            <span className="font-semibold text-sm tracking-tight">Aether-OS</span>
            <span className="font-mono text-[10px] text-muted-foreground">zero-knowledge vca</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Console</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map((item) => {
                const Icon = item.icon
                const active = isActive(item.href)
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                      <Link href={item.href}>
                        <Icon aria-hidden className="size-4" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t">
        <div className="flex items-center gap-2 px-1.5 py-2 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
          <Boxes className="size-3.5" aria-hidden />
          <span className="font-mono">v0.1.0</span>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
