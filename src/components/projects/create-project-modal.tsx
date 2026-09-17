"use client";

import { useState, useTransition } from "react";
import { Plus, Loader2, X } from "lucide-react";
import { createProject } from "@/actions/project";
import { isRedirectError } from "@/lib/action-errors";

const IDENTIFIER_REGEX = /^[A-Z]{3,5}$/;

export function CreateProjectModal({ variant = "sidebar" }: { variant?: "sidebar" | "solid" }) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function close() {
    setIsOpen(false);
    setName("");
    setIdentifier("");
    setError(null);
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Proje adı zorunludur.");
      return;
    }

    if (!IDENTIFIER_REGEX.test(identifier)) {
      setError("Tanımlayıcı 3-5 harf olmalıdır (sadece A-Z).");
      return;
    }

    const formData = new FormData();
    formData.set("name", name.trim());
    formData.set("identifier", identifier);

    startTransition(async () => {
      try {
        await createProject(formData);
      } catch (err) {
        if (isRedirectError(err)) {
          throw err;
        }
        setError(err instanceof Error ? err.message : "Proje oluşturulamadı.");
      }
    });
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={
          variant === "sidebar"
            ? "flex items-center justify-center gap-2 rounded-md bg-white/10 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-white/20"
            : "flex items-center justify-center gap-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        }
      >
        <Plus className="h-4 w-4" />
        Yeni Proje
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-lg dark:bg-zinc-900">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                Yeni Proje
              </h2>
              <button
                onClick={close}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                aria-label="Kapat"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {error ? (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
                  {error}
                </div>
              ) : null}

              <div className="flex flex-col gap-1.5">
                <label htmlFor="name" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Proje Adı
                </label>
                <input
                  id="name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="identifier" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Tanımlayıcı
                </label>
                <input
                  id="identifier"
                  type="text"
                  required
                  maxLength={5}
                  placeholder="PRJ"
                  value={identifier}
                  onChange={(e) =>
                    setIdentifier(e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 5))
                  }
                  className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm uppercase text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                />
                <p className="text-xs text-zinc-500 dark:text-zinc-400">3-5 harf, örn. PRJ</p>
              </div>

              <div className="mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={close}
                  className="rounded-md px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex items-center justify-center gap-2 rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Oluştur
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
