import { Blocks, Compass, LockKeyhole, Network, ShieldCheck, Sparkles } from "lucide-react"
import { MarketingPage } from "@/app/_components/marketing-page"

export const metadata = {
  title: "About | Aether-OS",
  description: "Why Aether-OS exists and how it approaches private, resilient cloud storage.",
}

export default function AboutPage() {
  return (
    <MarketingPage
      eyebrow="About Aether"
      title="Aether-OS is a control layer for private storage across clouds you already use."
      subtitle="The project starts from a simple belief: resilience should not require surrendering plaintext to another storage silo. Aether lets users combine providers while keeping encryption and recovery under their control."
      stats={[
        { value: "User", label: "Owns the keys", tone: "emerald" },
        { value: "Cloud", label: "Becomes substrate", tone: "sky" },
        { value: "Open", label: "Architecture direction", tone: "violet" },
      ]}
      sidePanel={{
        label: "principles",
        title: "Control, transparency, and recoverability guide the product.",
        body: "Aether is shaped as an operating surface for storage, not just a file upload UI.",
        rows: [
          { label: "Trust", value: "Minimize server knowledge" },
          { label: "Resilience", value: "Survive provider issues" },
          { label: "Clarity", value: "Expose pipeline state" },
          { label: "Ownership", value: "Use accounts you control" },
        ],
      }}
      sections={[
        {
          icon: Compass,
          title: "Why it exists",
          body: "Cloud storage became convenient but centralized. Aether explores a different path: user-held keys, multiple providers, and a console that shows how data moves.",
          items: ["Reduce provider lock-in", "Keep plaintext out of the control plane", "Make recovery paths understandable"],
        },
        {
          icon: LockKeyhole,
          title: "What it protects",
          body: "Aether focuses on encrypting file content before storage and keeping provider credentials under dedicated protection.",
          items: ["Client-side file encryption", "Encrypted provider credentials", "Explicit backend secret configuration"],
        },
        {
          icon: Network,
          title: "How it thinks about storage",
          body: "Storage providers are treated as interchangeable capacity and durability surfaces. The application layer tracks where encrypted shards live.",
          items: ["Provider-agnostic placement", "Shard maps and metadata", "Worker-backed operations"],
        },
        {
          icon: Blocks,
          title: "What comes next",
          body: "The roadmap centers on stronger recovery UX, broader provider support, placement policies, and clearer operator visibility.",
          items: ["Policy-based placement", "More provider adapters", "Recovery drills and health scoring"],
        },
      ]}
    >
      <section className="relative z-10 mx-auto max-w-7xl px-5 py-16 sm:px-8">
        <div className="rounded-lg border border-slate-800 bg-[#080b0f] p-8">
          <Sparkles className="size-7 text-emerald-300" />
          <h2 className="mt-5 text-2xl font-semibold text-white">The product stance</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">
            Aether should feel calm and technical: no mystery around storage state, no hidden plaintext dependency, and no promise that provider redundancy solves key management. It gives users sharp tools with clear edges.
          </p>
          <div className="mt-6 flex flex-wrap gap-3 text-sm">
            {["Private by design", "Provider-neutral", "Recovery-aware", "Operator-visible"].map((item) => (
              <span key={item} className="rounded border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-emerald-200">
                <ShieldCheck className="mr-2 inline size-4" />
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>
    </MarketingPage>
  )
}
