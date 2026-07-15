import { EyeOff, Fingerprint, KeyRound, LockKeyhole, ShieldCheck, Siren } from "lucide-react"
import { MarketingPage } from "@/app/_components/marketing-page"

export const metadata = {
  title: "Security | Aether-OS",
  description: "Aether-OS security posture for client-side encryption, provider credentials, and operational controls.",
}

export default function SecurityPage() {
  return (
    <MarketingPage
      eyebrow="Security overview"
      title="Strict defaults for a storage layer that should never need your plaintext."
      subtitle="Aether is designed around explicit trust boundaries: browsers handle file secrecy, the backend handles coordination, and provider tokens are protected as operational credentials."
      stats={[
        { value: "0", label: "Plaintext on server", tone: "emerald" },
        { value: "32B", label: "Provider secret key", tone: "sky" },
        { value: "60s", label: "Web API assertion", tone: "violet" },
      ]}
      sidePanel={{
        label: "posture",
        title: "Secrets are configuration, never fallback behavior.",
        body: "Production startup now requires explicit auth and provider-encryption secrets so insecure defaults cannot silently ship.",
        rows: [
          { label: "Auth", value: "Separate web and mobile token boundaries" },
          { label: "Providers", value: "32-byte encryption key" },
          { label: "Files", value: "Client-side encryption" },
          { label: "Recovery", value: "User-held passphrase" },
        ],
      }}
      sections={[
        {
          icon: LockKeyhole,
          title: "File secrecy begins before upload",
          body: "The browser encrypts file content before the backend receives it. Server systems coordinate storage but should not gain the material required to inspect file bytes.",
          items: ["AES-GCM encrypted chunks", "No plaintext file body in API handlers", "Recovery depends on user-held material"],
        },
        {
          icon: KeyRound,
          title: "Provider credentials are encrypted at rest",
          body: "Linked storage credentials are operationally necessary, so they are stored under a dedicated provider encryption key instead of generic application secrets.",
          items: ["Separate provider encryption key", "No insecure fallback secret", "Token use scoped to provider actions"],
        },
        {
          icon: Fingerprint,
          title: "Authentication uses explicit secret config",
          body: "The browser keeps a NextAuth identity session. Web-to-Go calls use short-lived server assertions, while Android uses revocable Go session JWTs.",
          items: ["AETHER_BFF_JWT_SECRET for web assertions", "GO_JWT_SECRET for Android sessions", "No long-lived Go JWT in the web session"],
        },
        {
          icon: EyeOff,
          title: "Metadata is minimized and purposeful",
          body: "Aether stores the metadata needed for volume navigation, placement, shard lookup, and reconstruction, while keeping file contents opaque.",
          items: ["Volume and inode records", "Shard placement maps", "Operational status without file plaintext"],
        },
      ]}
    >
      <section className="relative z-10 mx-auto max-w-7xl px-5 py-16 sm:px-8">
        <div className="rounded-lg border border-slate-800 bg-[#080b0f] p-8">
          <Siren className="size-7 text-emerald-300" />
          <h2 className="mt-5 text-2xl font-semibold text-white">Operational baseline</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">
            Deployments should provide strong random values for authentication and provider encryption. Rotate provider credentials carefully because encrypted provider tokens depend on the configured key.
          </p>
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {["Set distinct AETHER_BFF_JWT_SECRET and GO_JWT_SECRET values in production", "Set PROVIDER_ENCRYPTION_KEY to exactly 32 bytes", "Use HTTPS in front of API and client surfaces", "Keep volume passphrase recovery expectations clear"].map((item) => (
              <div key={item} className="flex items-start gap-3 rounded border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-300">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-300" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </MarketingPage>
  )
}
