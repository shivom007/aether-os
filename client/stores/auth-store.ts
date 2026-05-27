"use client"

import { create } from "zustand"

export interface MeUser {
  sub: string
  email: string
  salt_b64: string
}

interface AuthState {
  user: MeUser | null
  masterKey: CryptoKey | null // unextractable WebCrypto key
  setUser: (u: MeUser | null) => void
  setMasterKey: (k: CryptoKey | null) => void
  reset: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  masterKey: null,
  setUser: (user) => set({ user }),
  setMasterKey: (masterKey) => set({ masterKey }),
  reset: () => set({ user: null, masterKey: null }),
}))
