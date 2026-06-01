import Link from "next/link"
import { ArrowLeft, ArrowRight, CheckCircle2, Mail, ShieldCheck } from "lucide-react"

export const metadata = {
  title: "Early Access | Aether-OS",
  description: "Request early access to Aether-OS.",
}

const reasons = [
  "Test encrypted volume creation and provider linking",
  "Help shape shard recovery and provider routing workflows",
  "Get security and reliability updates before public launch",
]

export default function EarlyAccessPage() {
  return (
    <main className="min-h-screen bg-[#050708] text-slate-200">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(0,255,157,0.12),transparent_28%),radial-gradient(circle_at_85%_10%,rgba(56,189,248,0.1),transparent_24%)]" />

      <header className="relative z-10 border-b border-slate-800">
        <nav className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5 sm:px-8">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-slate-300 hover:text-emerald-300">
            <ArrowLeft className="size-4" />
            Back home
          </Link>
          <Link href="/login" className="rounded border border-slate-700 px-4 py-2 text-xs uppercase tracking-[0.18em] text-slate-300 hover:border-emerald-300 hover:text-emerald-300">
            Open console
          </Link>
        </nav>
      </header>

      <section className="relative z-10 mx-auto grid max-w-5xl gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:py-24">
        <div>
          <p className="inline-flex rounded border border-emerald-300/25 bg-emerald-300/10 px-3 py-1 text-xs uppercase tracking-[0.24em] text-emerald-200">
            Early access
          </p>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Help harden the private cloud mesh.
          </h1>
          <p className="mt-5 text-base leading-8 text-slate-400">
            Aether-OS is moving through active product validation. Use this route to request access, describe your storage setup, and tell us what would make the platform useful for you.
          </p>
          <div className="mt-8 grid gap-3">
            {reasons.map((reason) => (
              <div key={reason} className="flex items-start gap-3 text-sm text-slate-300">
                <CheckCircle2 className="mt-0.5 size-5 text-emerald-300" />
                {reason}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-6 shadow-2xl shadow-emerald-950/30">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded bg-emerald-300/10 text-emerald-300">
              <Mail className="size-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Request an invite</h2>
              <p className="text-sm text-slate-500">This form opens your email client with the request prefilled.</p>
            </div>
          </div>

          <form action="mailto:hello@aether-os.dev" method="post" encType="text/plain" className="grid gap-4">
            <label className="grid gap-2">
              <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Email</span>
              <input
                name="email"
                type="email"
                required
                placeholder="you@example.com"
                className="rounded border border-slate-800 bg-[#050708] px-4 py-3 text-sm text-white outline-none ring-emerald-300/20 placeholder:text-slate-600 focus:border-emerald-300 focus:ring-4"
              />
            </label>
            <label className="grid gap-2">
              <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Storage setup</span>
              <select
                name="storage_setup"
                className="rounded border border-slate-800 bg-[#050708] px-4 py-3 text-sm text-white outline-none ring-emerald-300/20 focus:border-emerald-300 focus:ring-4"
                defaultValue="mixed"
              >
                <option value="mixed">Mixed cloud providers</option>
                <option value="s3">S3-compatible storage</option>
                <option value="drive_dropbox">Drive / Dropbox accounts</option>
                <option value="evaluating">Still evaluating</option>
              </select>
            </label>
            <label className="grid gap-2">
              <span className="text-xs uppercase tracking-[0.18em] text-slate-500">What do you want to test?</span>
              <textarea
                name="use_case"
                rows={5}
                required
                placeholder="Tell us about your files, providers, and recovery requirements."
                className="resize-none rounded border border-slate-800 bg-[#050708] px-4 py-3 text-sm text-white outline-none ring-emerald-300/20 placeholder:text-slate-600 focus:border-emerald-300 focus:ring-4"
              />
            </label>
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 rounded bg-emerald-300 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-emerald-200"
            >
              Send request <ArrowRight className="size-4" />
            </button>
          </form>

          <div className="mt-6 rounded border border-sky-300/20 bg-sky-300/10 p-4">
            <div className="flex gap-3">
              <ShieldCheck className="mt-0.5 size-5 text-sky-200" />
              <p className="text-sm leading-6 text-slate-300">
                Prefer not to use mail forms? Send a short note directly to{" "}
                <a href="mailto:hello@aether-os.dev" className="text-sky-200 hover:text-sky-100">
                  hello@aether-os.dev
                </a>
                .
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
