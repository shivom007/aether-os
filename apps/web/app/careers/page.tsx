import { ArrowRight, BriefcaseBusiness, Code2, DatabaseZap, LifeBuoy, LockKeyhole, MapPin, Sparkles } from "lucide-react"
import Link from "next/link"
import { MarketingPage } from "@/app/_components/marketing-page"

export const metadata = {
  title: "Careers | Aether-OS",
  description: "Join Aether-OS to build private, resilient cloud storage infrastructure.",
}

const roles = [
  {
    title: "Product Engineer, Console",
    location: "Remote",
    body: "Build the dashboard workflows for encrypted volumes, provider setup, upload progress, and recovery drills.",
  },
  {
    title: "Platform Engineer, Storage",
    location: "Remote",
    body: "Improve worker orchestration, shard placement, provider adapters, and high-signal operational APIs.",
  },
  {
    title: "Security Engineer",
    location: "Remote",
    body: "Harden auth, secret handling, client-side encryption flows, and deployment checks around zero-knowledge assumptions.",
  },
]

export default function CareersPage() {
  return (
    <MarketingPage
      eyebrow="Careers"
      title="Build storage infrastructure where trust boundaries are part of the product."
      subtitle="Aether needs engineers and product thinkers who like precise systems, clear UX, and security models that users can actually understand."
      stats={[
        { value: "Remote", label: "First collaboration", tone: "emerald" },
        { value: "Deep", label: "Technical ownership", tone: "sky" },
        { value: "Calm", label: "Product culture", tone: "violet" },
      ]}
      sidePanel={{
        label: "hiring focus",
        title: "We value careful builders.",
        body: "The best work here connects user empathy with boringly reliable technical decisions.",
        rows: [
          { label: "Frontend", value: "Next.js, React, design systems" },
          { label: "Backend", value: "Go APIs, workers, storage" },
          { label: "Security", value: "Secrets, auth, crypto review" },
          { label: "Ops", value: "Metrics and incident learning" },
        ],
      }}
      sections={[
        {
          icon: Code2,
          title: "Craft matters",
          body: "You should enjoy turning complicated storage behavior into interfaces and APIs that feel obvious after they exist.",
          items: ["Readable code", "Precise product thinking", "Strong verification habits"],
        },
        {
          icon: LockKeyhole,
          title: "Security is shared",
          body: "Security work is not isolated to one team. Everyone owns part of the trust boundary and writes with that context in mind.",
          items: ["Threat-model awareness", "Careful secret handling", "Explicit failure states"],
        },
        {
          icon: DatabaseZap,
          title: "Systems have texture",
          body: "Provider APIs fail, jobs retry, queues back up, and users still need to recover files. That reality shapes the work.",
          items: ["Provider integrations", "Worker queues", "Recovery-first thinking"],
        },
        {
          icon: LifeBuoy,
          title: "Users are partners",
          body: "Early access feedback matters. The product should get clearer every time someone hits a rough edge.",
          items: ["Support-informed roadmap", "Documentation that respects risk", "Practical onboarding"],
        },
      ]}
    >
      <section className="relative z-10 mx-auto max-w-7xl px-5 py-16 sm:px-8">
        <div className="mb-8 flex items-end justify-between gap-5">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-emerald-300">Open roles</p>
            <h2 className="mt-3 text-3xl font-semibold text-white">Current focus areas</h2>
          </div>
          <Sparkles className="hidden size-8 text-emerald-300 sm:block" />
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {roles.map((role) => (
            <article key={role.title} className="rounded-lg border border-slate-800 bg-slate-950/70 p-6">
              <BriefcaseBusiness className="size-6 text-sky-300" />
              <h3 className="mt-5 text-xl font-semibold text-white">{role.title}</h3>
              <p className="mt-3 flex items-center gap-2 text-sm text-slate-500">
                <MapPin className="size-4" />
                {role.location}
              </p>
              <p className="mt-4 text-sm leading-7 text-slate-400">{role.body}</p>
              <Link href="mailto:hello@aether-os.dev?subject=Aether-OS role interest" className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-emerald-300 hover:text-emerald-200">
                Start a conversation <ArrowRight className="size-4" />
              </Link>
            </article>
          ))}
        </div>
      </section>
    </MarketingPage>
  )
}
