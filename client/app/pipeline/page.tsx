import { Blocks, CloudUpload, DatabaseZap, KeyRound, Network, RotateCcw } from "lucide-react"
import { MarketingPage } from "@/app/_components/marketing-page"

export const metadata = {
  title: "Pipeline | Aether-OS",
  description: "A detailed overview of how Aether-OS encrypts, shards, routes, and reconstructs files.",
}

export default function PipelinePage() {
  return (
    <MarketingPage
      eyebrow="Pipeline overview"
      title="From local file to distributed ciphertext, every step has a job."
      subtitle="The Aether pipeline keeps sensitive work close to the user, then lets the backend coordinate shards, providers, worker jobs, and recovery without needing plaintext."
      stats={[
        { value: "01", label: "Browser key derivation", tone: "emerald" },
        { value: "14", label: "Shards per chunk", tone: "sky" },
        { value: "10", label: "Needed to restore", tone: "violet" },
      ]}
      sidePanel={{
        label: "flow map",
        title: "The control plane handles placement, not secrets.",
        body: "Client code prepares encrypted chunks. Server-side workers schedule chunking, sharding, provider uploads, and health checks around opaque data.",
        rows: [
          { label: "Input", value: "Local browser file" },
          { label: "Protection", value: "AES-GCM before upload" },
          { label: "Durability", value: "Reed-Solomon parity" },
          { label: "Output", value: "Provider-specific shards" },
        ],
      }}
      sections={[
        {
          icon: KeyRound,
          title: "Key material stays client-side",
          body: "A volume passphrase derives encryption material inside the browser session. The backend receives encrypted payloads and coordination metadata, not the file content needed to read them.",
          items: ["Passphrase-led volume unlock", "Per-file encryption context", "No server-side plaintext recovery path"],
        },
        {
          icon: Blocks,
          title: "Chunks become resilient shard sets",
          body: "Large files are split into manageable chunks, encrypted, and encoded so each chunk can survive missing providers or delayed shard reads.",
          items: ["Deterministic chunk records", "Data shards plus parity shards", "Restore from any sufficient subset"],
        },
        {
          icon: CloudUpload,
          title: "Providers act as storage substrate",
          body: "Adapters place shard objects into linked providers while the control plane tracks placement, object ids, capacity, and provider health.",
          items: ["S3-compatible stores", "Dropbox and Drive style providers", "Placement metadata per shard"],
        },
        {
          icon: RotateCcw,
          title: "Recovery reverses the path",
          body: "Downloads gather enough shards, decode encrypted chunks, and return decryption to the browser where the original file can be reconstructed.",
          items: ["Parallel shard reads", "Erasure-code reconstruction", "Browser-side decrypt and assemble"],
        },
      ]}
    >
      <section className="relative z-10 mx-auto max-w-7xl px-5 py-16 sm:px-8">
        <div className="grid gap-4 lg:grid-cols-3">
          {[
            ["Queue", "Upload and retry jobs keep heavy work out of the request path."],
            ["Observe", "Worker and provider health data makes slow storage visible."],
            ["Route", "Placement can adapt as connected accounts become full or unavailable."],
          ].map(([title, body]) => (
            <article key={title} className="rounded-lg border border-slate-800 bg-slate-950/70 p-6">
              <Network className="size-6 text-sky-300" />
              <h2 className="mt-5 text-xl font-semibold text-white">{title}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-400">{body}</p>
            </article>
          ))}
        </div>
      </section>
    </MarketingPage>
  )
}
