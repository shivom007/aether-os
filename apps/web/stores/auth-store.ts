"use client"

import { create } from "zustand"

export interface MeUser {
  sub: string
  email: string
  salt_b64: string
}

interface AuthState {
  user: MeUser | null
  setUser: (u: MeUser | null) => void
  reset: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  reset: () => set({ user: null }),
}))
