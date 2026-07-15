import { Braces, Headphones, PanelsTopLeft, ShieldCheck, Users, Workflow } from "lucide-react"
import { MarketingPage } from "@/app/_components/marketing-page"

export const metadata = {
  title: "Teams | Aether-OS",
  description: "How Aether-OS organizes product, security, infrastructure, and user operations work.",
}

export default function TeamsPage() {
  return (
    <MarketingPage
      eyebrow="Teams overview"
      title="Aether is built by small teams with clear ownership of trust boundaries."
      subtitle="The work spans cryptography-aware product design, provider integrations, worker infrastructure, operations, and developer experience. Every team shares the same rule: make storage behavior visible."
      stats={[
        { value: "4", label: "Core disciplines", tone: "emerald" },
        { value: "1", label: "Shared security model", tone: "sky" },
        { value: "Async", label: "Operating rhythm", tone: "violet" },
      ]}
      sidePanel={{
        label: "operating model",
        title: "Small teams, explicit interfaces.",
        body: "The platform becomes safer when ownership boundaries are boringly clear: client secrecy, server coordination, provider adapters, and operator feedback.",
        rows: [
          { label: "Product", value: "Volume and recovery UX" },
          { label: "Platform", value: "Jobs, workers, APIs" },
          { label: "Security", value: "Secrets and threat model" },
          { label: "Ops", value: "Reliability and support" },
        ],
      }}
      sections={[
        {
          icon: PanelsTopLeft,
          title: "Product systems",
          body: "Designs the console workflows for volumes, provider setup, uploads, recovery, and everyday file navigation.",
          items: ["Dashboard ergonomics", "Recovery education", "Upload and browse surfaces"],
        },
        {
          icon: Braces,
          title: "Platform engineering",
          body: "Owns APIs, job queues, worker behavior, provider abstraction, and the data model that keeps shard placement understandable.",
          items: ["Go backend services", "Next.js API routes", "Provider adapters and worker orchestration"],
        },
        {
          icon: ShieldCheck,
          title: "Security engineering",
          body: "Maintains the threat model, reviews secret handling, hardens auth boundaries, and makes unsafe configuration fail early.",
          items: ["Client-side encryption review", "Provider-token protection", "Auth and deployment baselines"],
        },
        {
          icon: Headphones,
          title: "User operations",
          body: "Turns real-world storage failures into product improvements by watching provider health, support patterns, and recovery friction.",
          items: ["Early-access feedback", "Incident notes", "Provider reliability research"],
        },
      ]}
    >
      <section className="relative z-10 mx-auto max-w-7xl px-5 py-16 sm:px-8">
        <div className="grid gap-4 md:grid-cols-2">
          {[
            [Users, "Collaboration culture", "Written decisions, careful handoffs, and security notes close to the code."],
            [Workflow, "Release rhythm", "Ship focused improvements, verify routes and builds, then collect operational feedback."],
          ].map(([Icon, title, body]) => {
            const TeamIcon = Icon as typeof Users
            return (
              <article key={title as string} className="rounded-lg border border-slate-800 bg-slate-950/70 p-6">
                <TeamIcon className="size-6 text-sky-300" />
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
