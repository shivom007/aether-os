"use client"

import { useEffect } from "react"
import { useAuthStore, type MeUser } from "@/stores/auth-store"

/** Seeds the Zustand store with the server-rendered user so the client has it. */
export function SessionBootstrap({ user }: { user: MeUser }) {
  const setUser = useAuthStore((s) => s.setUser)
  useEffect(() => {
    setUser(user)
  }, [user, setUser])
  return null
}
