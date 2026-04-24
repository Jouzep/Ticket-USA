import { Sparkles } from "lucide-react";

export function Hero() {
  return (
    <header
      className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-900 via-brand-800 to-brand-700 px-6 py-10 text-white shadow-card sm:px-10 sm:py-14"
      aria-labelledby="hero-title"
    >
      {/* Soft glow accents — non-interactive */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-brand-500/30 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -left-20 h-72 w-72 rounded-full bg-brand-400/15 blur-3xl"
      />

      <div className="relative max-w-3xl">
        <span
          translate="no"
          className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-brand-100 ring-1 ring-inset ring-white/20 backdrop-blur"
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          WINIT&nbsp;·&nbsp;Fullstack &amp; AI Technical Challenge
        </span>
        <h1
          id="hero-title"
          className="mt-5 text-pretty text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl"
        >
          NY Parking Ticket Tracker
        </h1>
        <p className="mt-4 max-w-2xl text-pretty text-base text-brand-100/90 sm:text-lg">
          Real-time dashboard for fleet operators. Upload a CSV of summonses and
          watch the DMV scrape stream live, ticket by ticket.
        </p>
      </div>
    </header>
  );
}
