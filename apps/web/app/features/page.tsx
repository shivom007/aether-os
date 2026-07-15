import { Activity, Cloud, DatabaseZap, FolderTree, Gauge, Network, Settings2, UploadCloud } from "lucide-react"
import { MarketingPage } from "@/app/_components/marketing-page"

export const metadata = {
  title: "Features | Aether-OS",
  description: "Explore Aether-OS features for encrypted volumes, provider routing, uploads, observability, and recovery.",
}

export default function FeaturesPage() {
  return (
    <MarketingPage
      eyebrow="Feature overview"
      title="A storage console for people who want control without giving up resilience."
      subtitle="Aether combines encrypted volume management, provider adapters, worker visibility, and shard recovery into one operating surface for your distributed cloud layer."
      stats={[
        { value: "BYO", label: "Storage accounts", tone: "emerald" },
        { value: "Live", label: "Worker telemetry", tone: "sky" },
        { value: "RS", label: "Erasure coding", tone: "violet" },
      ]}
      sidePanel={{
        label: "console",
        title: "The dashboard is the operational center.",
        body: "Create volumes, connect providers, upload files, inspect worker health, and recover data from enough surviving shards.",
        rows: [
          { label: "Volumes", value: "Encrypted file namespaces" },
          { label: "Providers", value: "Connected storage backends" },
          { label: "Workers", value: "Chunk and shard jobs" },
          { label: "Observability", value: "Health and metrics views" },
        ],
      }}
      sections={[
        {
          icon: FolderTree,
          title: "Encrypted volumes",
          body: "Volumes group files under a user-controlled passphrase and provide a familiar namespace for browsing, upload, and restore workflows.",
          items: ["Volume-scoped unlock", "Folder and inode navigation", "Encrypted thumbnails and metadata awareness"],
        },
        {
          icon: Cloud,
          title: "Provider management",
          body: "Connect and monitor storage providers so Aether can distribute shards across independent accounts rather than a single closed silo.",
          items: ["Provider health checks", "Capacity-aware operations", "OAuth and S3-compatible integrations"],
        },
        {
          icon: UploadCloud,
          title: "Upload pipeline",
          body: "Uploads move through chunking, encryption, sharding, and provider placement with retryable jobs behind the scenes.",
          items: ["Batch and global upload surfaces", "Retryable chunk jobs", "Shard placement records"],
        },
        {
          icon: Activity,
          title: "Observability",
          body: "Operational views expose queues, workers, provider latency, and failure modes so storage behavior is understandable.",
          items: ["Worker health", "Provider latency checks", "Metrics and dashboard routes"],
        },
      ]}
    >
      <section className="relative z-10 mx-auto max-w-7xl px-5 py-16 sm:px-8">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            [DatabaseZap, "Shard intelligence", "Track where encrypted pieces live and what is required to rebuild."],
            [Network, "Route flexibility", "Move around provider outages and uneven latency with better placement context."],
            [Settings2, "Admin controls", "Keep provider, worker, and volume settings close to the workflows they affect."],
          ].map(([Icon, title, body]) => {
            const FeatureIcon = Icon as typeof Gauge
            return (
              <article key={title as string} className="rounded-lg border border-slate-800 bg-slate-950/70 p-6">
                <FeatureIcon className="size-6 text-sky-300" />
                <h2 className="mt-5 text-xl font-semibold text-white">{title as string}</h2>
                <p className="mt-3 text-sm leading-7 text-slate-400">{body as string}</p>
              </article>
            )
          })}
        </div>
      </section>
    </MarketingPage>
  )
}
