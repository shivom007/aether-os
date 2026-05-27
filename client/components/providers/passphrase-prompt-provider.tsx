"use client"

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface PassphrasePromptContextType {
  requestPassphrase: (title?: string, message?: string) => Promise<string>
}

const PassphrasePromptContext = createContext<PassphrasePromptContextType | null>(null)

export function usePassphrasePrompt() {
  const ctx = useContext(PassphrasePromptContext)
  if (!ctx) {
    throw new Error("usePassphrasePrompt must be used within a PassphrasePromptProvider")
  }
  return ctx
}

export function PassphrasePromptProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [title, setTitle] = useState("Enter Passphrase")
  const [message, setMessage] = useState("Please enter your volume passphrase to continue.")
  const [passphrase, setPassphrase] = useState("")

  const resolverRef = useRef<((pass: string) => void) | null>(null)
  const rejecterRef = useRef<((err: Error) => void) | null>(null)

  const requestPassphrase = useCallback((t?: string, m?: string): Promise<string> => {
    if (t) setTitle(t)
    if (m) setMessage(m)
    setPassphrase("")
    setIsOpen(true)

    return new Promise((resolve, reject) => {
      resolverRef.current = resolve
      rejecterRef.current = reject
    })
  }, [])

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!passphrase) return
    
    if (resolverRef.current) {
      resolverRef.current(passphrase)
      resolverRef.current = null
      rejecterRef.current = null
    }
    
    // Clear state
    setPassphrase("")
    setIsOpen(false)
  }

  const handleCancel = () => {
    if (rejecterRef.current) {
      rejecterRef.current(new Error("Passphrase prompt cancelled by user"))
      resolverRef.current = null
      rejecterRef.current = null
    }
    setPassphrase("")
    setIsOpen(false)
  }
  
  // Cleanup if unmounted while open
  useEffect(() => {
    return () => {
      if (rejecterRef.current) {
        rejecterRef.current(new Error("Passphrase prompt unmounted"))
      }
    }
  }, [])

  return (
    <PassphrasePromptContext.Provider value={{ requestPassphrase }}>
      {children}
      
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-xl relative z-50 animate-in fade-in zoom-in-95 duration-200">
            <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{message}</p>
            
            <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
              <Input
                type="password"
                placeholder="Volume Passphrase"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                autoFocus
                autoComplete="off"
                data-lpignore="true"
              />
              <div className="flex justify-end gap-2 mt-2">
                <Button type="button" variant="ghost" onClick={handleCancel}>
                  Cancel
                </Button>
                <Button type="submit" disabled={!passphrase}>
                  Unlock
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PassphrasePromptContext.Provider>
  )
}
