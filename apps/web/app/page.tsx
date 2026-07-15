import Link from "next/link"
import { MarketingShell } from "@/app/_components/marketing-page"
import { ArrowRight, CheckCircle2, Cloud, DatabaseZap, KeyRound, LockKeyhole, Network, ShieldCheck } from "lucide-react"

export const metadata = {
  title: "Aether-OS | Zero-Knowledge Cloud Aggregator",
  description: "Client-side encryption, erasure coding, and multi-provider storage for files that stay yours.",
}

const features = [
  {
    icon: LockKeyhole,
    title: "Zero-knowledge by default",
    body: "Files are encrypted before upload. The server stores ciphertext and metadata, never plaintext or volume passphrases.",
  },
  {
    icon: DatabaseZap,
    title: "RS(10,4) shard layout",
    body: "Each encrypted chunk becomes 14 shards. Any 10 can reconstruct the original, giving fault tolerance without full-copy replication.",
  },
  {
    icon: Cloud,
    title: "Bring your own providers",
    body: "Connect S3-compatible storage, Dropbox, and Google Drive, then distribute shards across accounts you control.",
  },
  {
    icon: Network,
    title: "Resilient routing",
    body: "Aether can keep upload and download paths flexible as providers become slow, full, unavailable, or retired.",
  },
]

const pipeline = [
  ["01", "Derive", "A volume passphrase derives local encryption material inside the browser."],
  ["02", "Encrypt", "Each chunk is encrypted with AES-GCM before the backend receives anything."],
  ["03", "Shard", "Reed-Solomon coding splits encrypted chunks into data and parity pieces."],
  ["04", "Distribute", "Provider adapters place shards across independent storage backends."],
]

const checks = [
  "No plaintext file content on Aether servers",
  "Client-side thumbnails encrypted with the volume key",
  "Provider credentials encrypted at rest",
  "Dedicated dashboard for volumes, providers, shards, and downloads",
]

const faqs = [
  {
    q: "Is this a replacement for Google Drive or Dropbox?",
    a: "It is a control layer above them. Aether lets you use multiple providers as storage substrate while keeping encryption and reconstruction logic in your own app layer.",
  },
  {
    q: "What happens if one provider fails?",
    a: "The erasure-coded layout is designed so a file can still be reconstructed from enough remaining shards. With RS(10,4), any 10 of 14 shards are enough.",
  },
  {
    q: "Can Aether recover my passphrase?",
    a: "No. That is the point of the design. If the passphrase or recovery material is lost, encrypted data cannot be decrypted by the service.",
  },
]

export default function HomePage() {
  return (
    <MarketingShell>
      <section className="relative z-10 mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl items-center gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:py-20">
        <div>
          <p className="mb-5 inline-flex rounded border border-emerald-300/25 bg-emerald-300/10 px-3 py-1 text-xs uppercase tracking-[0.24em] text-emerald-200">
            Client-side encrypted cloud mesh
          </p>
          <h1 className="max-w-4xl text-5xl font-semibold tracking-tight text-white sm:text-6xl lg:text-7xl">
            Your files. Your keys. Every provider.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-slate-400 sm:text-lg">
            Aether-OS turns disconnected cloud accounts into a resilient encrypted storage layer. Files are encrypted in the browser, sharded for fault tolerance, and distributed across storage you control.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/early-access" className="inline-flex items-center gap-2 rounded bg-emerald-300 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-emerald-200">
              Request early access <ArrowRight className="size-4" />
            </Link>
            <Link href="/signup" className="inline-flex items-center gap-2 rounded border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-200 hover:border-sky-300 hover:text-sky-200">
              Create account
            </Link>
          </div>
          <dl className="mt-10 grid max-w-2xl grid-cols-3 gap-3">
            <div className="border-l border-emerald-300/30 pl-4">
              <dt className="text-2xl font-semibold text-emerald-200">AES</dt>
              <dd className="text-xs uppercase tracking-[0.18em] text-slate-500">GCM encryption</dd>
            </div>
            <div className="border-l border-sky-300/30 pl-4">
              <dt className="text-2xl font-semibold text-sky-200">14</dt>
              <dd className="text-xs uppercase tracking-[0.18em] text-slate-500">Total shards</dd>
            </div>
            <div className="border-l border-violet-300/30 pl-4">
              <dt className="text-2xl font-semibold text-violet-200">10</dt>
              <dd className="text-xs uppercase tracking-[0.18em] text-slate-500">Needed to restore</dd>
            </div>
          </dl>
        </div>

        <div className="relative">
          <div className="absolute -inset-4 rounded-full border border-emerald-300/10" />
          <div className="relative overflow-hidden rounded-lg border border-slate-800 bg-slate-950/80 shadow-2xl shadow-emerald-950/30">
            <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/80 px-4 py-3">
              <div className="flex gap-2">
                <span className="size-3 rounded-full bg-red-400" />
                <span className="size-3 rounded-full bg-yellow-300" />
                <span className="size-3 rounded-full bg-emerald-300" />
              </div>
              <span className="text-xs uppercase tracking-[0.2em] text-slate-500">live topology</span>
            </div>
            <div className="grid gap-5 p-5 sm:p-7">
              <div className="rounded border border-emerald-300/20 bg-emerald-300/10 p-4">
                <div className="flex items-center gap-3">
                  <KeyRound className="size-5 text-emerald-200" />
                  <div>
                    <p className="text-sm font-medium text-white">Browser key vault</p>
                    <p className="text-xs text-slate-400">Passphrase never leaves device</p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {["chunk_0", "chunk_1", "chunk_2", "chunk_3"].map((chunk, index) => (
                  <div key={chunk} className="rounded border border-slate-800 bg-slate-900/70 p-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{chunk}</p>
                    <div className="mt-3 grid grid-cols-7 gap-1">
                      {Array.from({ length: 14 }).map((_, shard) => (
                        <span
                          key={shard}
                          className={`h-5 rounded-sm ${shard < 10 ? "bg-sky-300/70" : "bg-emerald-300/80"}`}
                          title={`chunk ${index} shard ${shard}`}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-3 text-center text-xs text-slate-400">
                <div className="rounded border border-slate-800 bg-slate-900/50 p-3">Drive</div>
                <div className="rounded border border-slate-800 bg-slate-900/50 p-3">Dropbox</div>
                <div className="rounded border border-slate-800 bg-slate-900/50 p-3">S3/R2</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="pipeline" className="relative z-10 border-y border-slate-800 bg-slate-950/50 py-20">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="max-w-2xl">
            <p className="text-xs uppercase tracking-[0.24em] text-emerald-300">Pipeline</p>
            <h2 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">A clear path from local file to distributed ciphertext.</h2>
          </div>
          <div className="mt-10 grid gap-px overflow-hidden rounded-lg border border-slate-800 bg-slate-800 md:grid-cols-4">
            {pipeline.map(([num, title, body]) => (
              <article key={num} className="bg-[#080b0f] p-6">
                <p className="text-xs font-semibold text-emerald-300">[{num}]</p>
                <h3 className="mt-4 text-lg font-semibold text-white">{title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-400">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="relative z-10 mx-auto max-w-7xl px-5 py-20 sm:px-8">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-emerald-300">Features</p>
            <h2 className="mt-3 max-w-2xl text-3xl font-semibold text-white sm:text-4xl">Built for storage control, not another closed silo.</h2>
          </div>
          <Link href="/dashboard/volumes" className="inline-flex items-center gap-2 text-sm font-medium text-sky-200 hover:text-sky-100">
            View dashboard route <ArrowRight className="size-4" />
          </Link>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {features.map((feature) => (
            <article key={feature.title} className="rounded-lg border border-slate-800 bg-slate-950/70 p-6">
              <feature.icon className="size-6 text-emerald-300" />
              <h3 className="mt-5 text-xl font-semibold text-white">{feature.title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-400">{feature.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="security" className="relative z-10 border-y border-slate-800 bg-[#080b0f] py-20">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 sm:px-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-emerald-300">Security posture</p>
            <h2 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">The defaults should be boringly strict.</h2>
            <p className="mt-5 text-sm leading-7 text-slate-400">
              Aether is designed around one rule: sensitive material must have an explicit reason to exist on the server. The homepage buttons now route to real pages, and the app console remains behind auth.
            </p>
          </div>
          <div className="grid gap-3">
            {checks.map((check) => (
              <div key={check} className="flex items-start gap-3 rounded border border-slate-800 bg-slate-950/70 p-4">
                <CheckCircle2 className="mt-0.5 size-5 text-emerald-300" />
                <span className="text-sm text-slate-300">{check}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="faq" className="relative z-10 mx-auto max-w-4xl px-5 py-20 sm:px-8">
        <p className="text-xs uppercase tracking-[0.24em] text-emerald-300">FAQ</p>
        <h2 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">Common questions</h2>
        <div className="mt-8 divide-y divide-slate-800 rounded-lg border border-slate-800 bg-slate-950/70">
          {faqs.map((faq) => (
            <details key={faq.q} className="group p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-medium text-white">
                {faq.q}
                <span className="text-emerald-300 transition group-open:rotate-90">+</span>
              </summary>
              <p className="mt-4 text-sm leading-7 text-slate-400">{faq.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-7xl px-5 pb-20 sm:px-8">
        <div className="rounded-lg border border-emerald-300/20 bg-emerald-300/10 p-8 sm:p-10">
          <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <ShieldCheck className="mb-5 size-8 text-emerald-300" />
              <h2 className="text-3xl font-semibold text-white">Ready to try the private cloud mesh?</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
                Join early access for product updates, testing invites, and direct feedback loops while the platform hardens.
              </p>
            </div>
            <Link href="/early-access" className="inline-flex items-center justify-center gap-2 rounded bg-emerald-300 px-6 py-3 text-sm font-semibold text-slate-950 hover:bg-emerald-200">
              Request access <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>

    </MarketingShell>
  )
}
