'use client'

import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import {
  Search,
  ArrowRight,
  Building2,
  Network,
  Bot,
  CheckCircle2,
  TrendingUp,
  ShieldCheck,
} from "lucide-react"

export default function HomePage() {
  const router = useRouter()

  const stats = [
    { value: "320+", label: "Verified Institutions" },
    { value: "10K+", label: "Students Guided" },
    { value: "95%", label: "Success Rate" },
  ]

  const features = [
    {
      icon: Building2,
      title: "College Search & Comparison",
      body: "Compare placements, median salary, and campus data using our multi-dimensional comparison engine.",
      cta: "Explore Search",
      route: "/college-search",
    },
    {
      icon: Network,
      title: "Expert Branch Explorer",
      body: "Deep-dive into academic branches. Understand cutoff trends and industry demand before you commit.",
      cta: "View Branches",
      route: "/branch-explorer",
    },
    {
      icon: Bot,
      title: "AI-Assisted Choice Filling",
      body: "Optimise your preference list with algorithmic matching that considers rank, historical trends, and goals.",
      cta: "Try AI Assistant",
      route: "/choice-filling",
    },
  ]

  const mission = [
    { title: "Data Integrity", body: "Every statistic is cross-referenced with official NIRF and TNEA disclosures." },
    { title: "Student-Centric", body: "We are independent of any institution, keeping our guidance 100% unbiased." },
    { title: "Modern Tools", body: "Leveraging our Power Score and AI methods to match you to colleges where you'll thrive." },
  ]

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden bg-card border-b border-border">
          <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-16 md:py-24 grid grid-cols-1 lg:grid-cols-2 gap-stack-xl items-center">
            <div className="space-y-stack-lg animate-fade-in">
              <span className="inline-flex items-center gap-2 rounded-full bg-secondary text-secondary-foreground px-3 py-1.5 text-label-bold uppercase tracking-wider">
                <ShieldCheck className="h-4 w-4" /> Admission Cycle 2025-26 Open
              </span>
              <h1 className="font-heading text-headline-lg-mobile md:text-headline-xl text-primary leading-tight">
                Find Your Future at the <span className="text-brand-blue">Right College</span>
              </h1>
              <p className="font-sans text-body-lg text-slate max-w-lg">
                Empowering students with unbiased, data-driven insights and expert guidance to navigate the path toward academic excellence.
              </p>

              {/* Search */}
              <div className="bg-card border border-border rounded-xl p-2 flex flex-col md:flex-row items-stretch md:items-center gap-stack-sm max-w-2xl shadow-sm">
                <div className="flex items-center flex-1 px-4">
                  <Search className="h-5 w-5 text-slate mr-2 shrink-0" />
                  <input
                    className="w-full bg-transparent border-none focus:outline-none text-body-md py-3 placeholder:text-slate"
                    placeholder="Search by institution, course, or location"
                    onKeyDown={(e) => { if (e.key === "Enter") router.push("/college-search") }}
                  />
                </div>
                <Button size="lg" className="rounded-lg font-bold px-stack-lg" onClick={() => router.push("/college-search")}>
                  Start Your Journey
                </Button>
              </div>

              <div className="flex items-center gap-stack-md text-slate text-body-sm">
                <div className="flex -space-x-2">
                  <span className="w-8 h-8 rounded-full border-2 border-card bg-muted flex items-center justify-center text-[10px] font-bold text-primary">JD</span>
                  <span className="w-8 h-8 rounded-full border-2 border-card bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold">AS</span>
                  <span className="w-8 h-8 rounded-full border-2 border-card bg-secondary text-secondary-foreground flex items-center justify-center text-[10px] font-bold">RK</span>
                </div>
                <span>Joined by <strong className="text-primary">10,000+</strong> students this month</span>
              </div>
            </div>

            {/* Visual panel — hero image */}
            <div className="relative hidden lg:block">
              <div className="absolute -top-12 -right-12 w-64 h-64 rounded-full bg-surface-container-high blur-3xl opacity-60" />
              <div className="relative z-10 rounded-2xl overflow-hidden border border-border shadow-xl aspect-[4/3] bg-surface-container">
                <img src="/hero-image.jpg" alt="Students on a modern university campus" className="w-full h-full object-cover" />
              </div>
              {/* Floating stat card */}
              <div className="absolute -bottom-6 -left-6 z-20 bg-card p-stack-md rounded-xl shadow-xl border border-border flex items-center gap-stack-md animate-bounce-slow">
                <span className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <TrendingUp className="h-6 w-6" />
                </span>
                <div>
                  <div className="text-primary font-bold text-headline-md font-heading">95%</div>
                  <div className="text-slate text-body-sm">Counseling Success</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Trust indicators */}
        <section className="py-stack-lg bg-surface-container-low border-y border-border">
          <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop grid grid-cols-1 md:grid-cols-3 gap-gutter text-center">
            {stats.map((s, i) => (
              <div key={s.label} className={`p-stack-md ${i === 1 ? "md:border-x border-border" : ""}`}>
                <div className="text-primary font-bold text-headline-xl font-heading mb-1">{s.value}</div>
                <div className="text-slate font-label-bold text-label-bold tracking-wider uppercase">{s.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Core features */}
        <section className="py-stack-xl bg-background">
          <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop">
            <div className="text-center max-w-2xl mx-auto mb-stack-xl">
              <h2 className="font-heading text-headline-lg text-primary mb-stack-md">Specialized Counseling Ecosystem</h2>
              <p className="text-slate text-body-lg">
                Navigate the complex college admissions landscape with precision tools designed for institutional clarity.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
              {features.map((f) => (
                <button
                  key={f.title}
                  onClick={() => router.push(f.route)}
                  className="text-left bg-card p-stack-lg rounded-xl border border-border hover:shadow-lg hover:-translate-y-0.5 transition-all group"
                >
                  <div className="w-16 h-16 rounded-xl bg-surface-container flex items-center justify-center text-primary mb-stack-lg group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <f.icon className="h-8 w-8" />
                  </div>
                  <h3 className="font-heading text-headline-md text-primary mb-stack-sm">{f.title}</h3>
                  <p className="text-slate text-body-md mb-stack-lg leading-relaxed">{f.body}</p>
                  <span className="inline-flex items-center gap-1 text-primary font-bold group-hover:gap-2 transition-all">
                    {f.cta} <ArrowRight className="h-4 w-4" />
                  </span>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Mission */}
        <section className="py-stack-xl bg-surface-container-low">
          <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop grid grid-cols-1 lg:grid-cols-2 gap-stack-xl items-center">
            <div className="order-2 lg:order-1 grid grid-cols-2 gap-stack-md">
              <div className="rounded-xl border border-border overflow-hidden bg-surface-container aspect-[4/5]">
                <img src="/mission-1.jpg" alt="Students collaborating on college research" className="w-full h-full object-cover" />
              </div>
              <div className="rounded-xl border border-border overflow-hidden bg-surface-container aspect-[4/5] mt-stack-lg">
                <img src="/mission-2.jpg" alt="Researching colleges with data on a laptop" className="w-full h-full object-cover" />
              </div>
            </div>

            <div className="order-1 lg:order-2 space-y-stack-lg">
              <div className="text-brand-blue font-label-bold text-label-bold tracking-widest uppercase">Our Mission</div>
              <h2 className="font-heading text-headline-lg text-primary">Unbiased Counseling for Global Ambitions</h2>
              <p className="text-slate text-body-lg leading-relaxed">
                We believe academic decisions should be built on data, not hearsay. Our platform bridges the gap between institutional information and what students actually need.
              </p>
              <ul className="space-y-stack-md">
                {mission.map((m) => (
                  <li key={m.title} className="flex items-start gap-stack-md">
                    <CheckCircle2 className="h-5 w-5 text-primary mt-1 shrink-0" />
                    <span className="text-body-md text-foreground">
                      <strong>{m.title}:</strong> {m.body}
                    </span>
                  </li>
                ))}
              </ul>
              <Button
                variant="outline"
                size="lg"
                className="border-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground rounded-lg font-bold"
                onClick={() => router.push("/choice-filling-guide")}
              >
                Learn More About Us
              </Button>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-stack-xl">
          <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop">
            <div className="bg-primary rounded-3xl p-12 lg:p-24 text-center relative overflow-hidden">
              <div
                className="absolute inset-0 opacity-10"
                style={{ backgroundImage: "radial-gradient(circle at 2px 2px, white 1px, transparent 0)", backgroundSize: "40px 40px" }}
              />
              <div className="relative z-10 max-w-3xl mx-auto space-y-stack-lg">
                <h2 className="font-heading text-headline-xl text-primary-foreground">Ready to Start Your Future?</h2>
                <p className="text-primary-foreground/90 text-body-lg">
                  Join over 10,000 students who have found their perfect academic match. Get started with a free profile or talk to our experts today.
                </p>
                <div className="flex flex-col sm:flex-row gap-stack-md justify-center pt-stack-md">
                  <Button
                    size="lg"
                    className="bg-card text-primary hover:bg-secondary rounded-lg font-bold px-stack-xl py-6 text-body-md"
                    onClick={() => router.push("/login?tab=signup")}
                  >
                    Create Free Account
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    className="border-2 border-white/40 bg-transparent text-primary-foreground hover:bg-white/10 rounded-lg font-bold px-stack-xl py-6 text-body-md"
                    onClick={() => router.push("/contact")}
                  >
                    Speak to a Counselor
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
