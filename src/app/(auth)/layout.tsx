import { APP_VERSION } from "@/lib/version";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-baseline justify-center gap-1.5">
          <p className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Pulse
          </p>
          <span className="translate-y-0.5 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-mono font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            v{APP_VERSION}
          </span>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          {children}
        </div>
      </div>
    </div>
  );
}
