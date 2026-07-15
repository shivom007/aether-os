import Link from "next/link"
import type { ReactNode } from "react"
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Home,
  LucideIcon,
  Mail,
  ShieldCheck,
} from "lucide-react"

type Cta = {
  href: string
  label: string
}

type Stat = {
  label: string
  value: string
  tone?: "emerald" | "sky" | "violet"
}

type Section = {
  icon: LucideIcon
  title: string
  body: string
  items?: string[]
}

type SidePanel = {
  label: string
  title: string
  body: string
  rows: Array<{
    label: string
    value: string
  }>
}

type MarketingPageProps = {
  eyebrow: string
  title: string
  subtitle: string
  primaryCta?: Cta
  secondaryCta?: Cta
  stats?: Stat[]
  sections: Section[]
  sidePanel?: SidePanel
  children?: ReactNode
}

type LegalPageProps = {
  title: string
  subtitle: string
  updated: string
  sections: Array<{
    title: string
    body: ReactNode
  }>
}

const navLinks = [
  ["Pipeline", "/pipeline"],
  ["Security", "/security"],
  ["Features", "/features"],
  ["About", "/about"],
  ["Teams", "/teams"],
  ["Careers", "/careers"],
]

const statTone = {
  emerald: "border-emerald-300/30 text-emerald-200",
  sky: "border-sky-300/30 text-sky-200",
  violet: "border-violet-300/30 text-violet-200",
}

export function MarketingShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-[#050708] text-slate-200">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(0,255,157,0.12),transparent_28%),radial-gradient(circle_at_80%_0%,rgba(56,189,248,0.1),transparent_26%),linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:auto,auto,40px_40px,40px_40px]" />

      <header className="sticky top-0 z-30 border-b border-emerald-400/10 bg-[#050708]/90 backdrop-blur">
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link href="/" className="flex items-center gap-3 text-sm font-semibold tracking-[0.24em] text-slate-100">
            <img src="/icon.svg" alt="" className="size-8" />
            AETHER-OS
          </Link>
          <div className="hidden items-center gap-5 text-xs uppercase tracking-[0.16em] text-slate-400 lg:flex">
            {navLinks.map(([label, href]) => (
              <Link key={href} href={href} className="hover:text-emerald-300">
                {label}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Link href="/login" className="hidden rounded border border-slate-700 px-4 py-2 text-xs uppercase tracking-[0.18em] text-slate-300 hover:border-emerald-300 hover:text-emerald-300 sm:inline-flex">
              Open Console
            </Link>
            <Link href="/early-access" className="inline-flex items-center gap-2 rounded bg-emerald-300 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-950 hover:bg-emerald-200">
              Early Access <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </nav>
      </header>

      {children}

      <footer className="relative z-10 border-t border-slate-800 px-5 py-8 text-sm text-slate-500 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p>Aether-OS. Your keys. Your data.</p>
          <div className="flex flex-wrap gap-5">
            <Link href="/privacy" className="hover:text-emerald-300">Privacy</Link>
            <Link href="/terms" className="hover:text-emerald-300">Terms</Link>
            <a href="mailto:hello@aether-os.dev" className="hover:text-emerald-300">Contact</a>
          </div>
        </div>
      </footer>
    </main>
  )
}

export function MarketingPage({
  eyebrow,
  title,
  subtitle,
  primaryCta = { href: "/early-access", label: "Request early access" },
  secondaryCta = { href: "/", label: "Back home" },
  stats = [],
  sections,
  sidePanel,
  children,
}: MarketingPageProps) {
  return (
    <MarketingShell>
      <section className="relative z-10 mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[1fr_0.82fr] lg:py-20">
        <div>
          <p className="mb-5 inline-flex rounded border border-emerald-300/25 bg-emerald-300/10 px-3 py-1 text-xs uppercase tracking-[0.24em] text-emerald-200">
            {eyebrow}
          </p>
          <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
            {title}
          </h1>
          <p className="mt-6 max-w-3xl text-base leading-8 text-slate-400 sm:text-lg">
            {subtitle}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={primaryCta.href} className="inline-flex items-center gap-2 rounded bg-emerald-300 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-emerald-200">
              {primaryCta.label} <ArrowRight className="size-4" />
            </Link>
            <Link href={secondaryCta.href} className="inline-flex items-center gap-2 rounded border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-200 hover:border-sky-300 hover:text-sky-200">
              {secondaryCta.label}
            </Link>
          </div>
          {stats.length > 0 && (
            <dl className="mt-10 grid max-w-3xl gap-3 sm:grid-cols-3">
              {stats.map((stat) => (
                <div key={stat.label} className={`border-l pl-4 ${statTone[stat.tone ?? "emerald"]}`}>
                  <dt className="text-2xl font-semibold">{stat.value}</dt>
                  <dd className="text-xs uppercase tracking-[0.18em] text-slate-500">{stat.label}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        {sidePanel && (
          <aside className="relative overflow-hidden rounded-lg border border-slate-800 bg-slate-950/80 shadow-2xl shadow-emerald-950/30">
            <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/80 px-4 py-3">
              <div className="flex gap-2">
                <span className="size-3 rounded-full bg-red-400" />
                <span className="size-3 rounded-full bg-yellow-300" />
                <span className="size-3 rounded-full bg-emerald-300" />
              </div>
              <span className="text-xs uppercase tracking-[0.2em] text-slate-500">{sidePanel.label}</span>
            </div>
            <div className="p-6">
              <ShieldCheck className="size-7 text-emerald-300" />
              <h2 className="mt-5 text-2xl font-semibold text-white">{sidePanel.title}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-400">{sidePanel.body}</p>
              <div className="mt-6 divide-y divide-slate-800 rounded border border-slate-800">
                {sidePanel.rows.map((row) => (
                  <div key={row.label} className="grid grid-cols-[0.9fr_1.1fr] gap-4 px-4 py-3 text-sm">
                    <span className="text-slate-500">{row.label}</span>
                    <span className="font-medium text-slate-200">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        )}
      </section>

      <section className="relative z-10 border-y border-slate-800 bg-slate-950/50 py-16">
        <div className="mx-auto grid max-w-7xl gap-4 px-5 sm:px-8 md:grid-cols-2">
          {sections.map((section) => (
            <article key={section.title} className="rounded-lg border border-slate-800 bg-[#080b0f] p-6">
              <section.icon className="size-6 text-emerald-300" />
              <h2 className="mt-5 text-xl font-semibold text-white">{section.title}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-400">{section.body}</p>
              {section.items && (
                <div className="mt-5 grid gap-3">
                  {section.items.map((item) => (
                    <div key={item} className="flex items-start gap-3 text-sm text-slate-300">
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-300" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      </section>

      {children}

      <section className="relative z-10 mx-auto max-w-7xl px-5 py-16 sm:px-8">
        <div className="rounded-lg border border-emerald-300/20 bg-emerald-300/10 p-8 sm:p-10">
          <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <Mail className="mb-5 size-8 text-emerald-300" />
              <h2 className="text-3xl font-semibold text-white">Bring your storage plan into the mesh.</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
                Request early access to test encrypted volumes, provider routing, and recovery flows with the team.
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

export function LegalPage({ title, subtitle, updated, sections }: LegalPageProps) {
  return (
    <MarketingShell>
      <section className="relative z-10 mx-auto max-w-5xl px-5 py-16 sm:px-8 lg:py-20">
        <p className="mb-5 inline-flex rounded border border-emerald-300/25 bg-emerald-300/10 px-3 py-1 text-xs uppercase tracking-[0.24em] text-emerald-200">
          Legal
        </p>
        <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
          {title}
        </h1>
        <p className="mt-6 max-w-3xl text-base leading-8 text-slate-400 sm:text-lg">
          {subtitle}
        </p>
        <p className="mt-5 text-sm text-slate-500">Last updated: {updated}</p>
      </section>

      <section className="relative z-10 border-y border-slate-800 bg-slate-950/50 py-12">
        <div className="mx-auto max-w-5xl px-5 sm:px-8">
          <div className="divide-y divide-slate-800 rounded-lg border border-slate-800 bg-[#080b0f]">
            {sections.map((section, index) => (
              <article key={section.title} className="p-6 sm:p-8">
                <p className="text-xs font-semibold text-emerald-300">[{String(index + 1).padStart(2, "0")}]</p>
                <h2 className="mt-3 text-2xl font-semibold text-white">{section.title}</h2>
                <div className="mt-4 space-y-4 text-sm leading-7 text-slate-400">{section.body}</div>
              </article>
            ))}
          </div>
          <Link href="/early-access" className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-emerald-300 hover:text-emerald-200">
            Questions about these terms <ChevronRight className="size-4" />
          </Link>
        </div>
      </section>
    </MarketingShell>
  )
}
