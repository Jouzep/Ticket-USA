import { Dashboard } from "@/components/organisms/dashboard";
import { Hero } from "@/components/organisms/hero";

export default function Home() {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:left-4 focus-visible:top-4 focus-visible:z-50 focus-visible:rounded-lg focus-visible:bg-brand-700 focus-visible:px-4 focus-visible:py-2 focus-visible:text-white"
      >
        Skip to main content
      </a>
      <main
        id="main"
        className="mx-auto min-h-screen w-full max-w-6xl space-y-8 px-4 py-8 sm:py-10"
      >
        <Hero />
        <Dashboard />
        <footer className="pt-4 text-center text-xs text-ink-400">
          © 2026 · Built for WINIT Technical Recruitment
        </footer>
      </main>
    </>
  );
}
