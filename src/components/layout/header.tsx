"use client";

import { useRef, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { LogOut, User as UserIcon } from "lucide-react";
import { Avatar } from "@/components/assignees/avatar";
import { Breadcrumb, type BreadcrumbItem } from "@/components/layout/breadcrumb";
import { ClockControl } from "@/components/layout/clock-control";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { useClickOutside } from "@/lib/use-click-outside";

export function Header({ items }: { items: BreadcrumbItem[] }) {
  const { data: session } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  useClickOutside(containerRef, () => setIsOpen(false));

  const name = session?.user?.name ?? session?.user?.email ?? "";

  return (
    <header className="flex shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900">
      <Breadcrumb items={items} />

      <div className="flex items-center gap-3">
        <ClockControl />
        <NotificationBell />

        <div ref={containerRef} className="relative">
          <button
            type="button"
            onClick={() => setIsOpen((v) => !v)}
            aria-label="Kullanıcı menüsü"
            className="flex items-center gap-2 rounded-full hover:opacity-80"
          >
            <Avatar name={name} size="sm" />
          </button>

          {isOpen ? (
            <div className="absolute right-0 top-full z-40 mt-2 w-48 rounded-md border border-zinc-200 bg-white p-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
              <div className="border-b border-zinc-100 px-3 py-2 text-sm font-medium text-zinc-900 dark:border-zinc-800 dark:text-zinc-100">
                {name}
              </div>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <UserIcon className="h-4 w-4" />
                Profil
              </button>
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <LogOut className="h-4 w-4" />
                Çıkış yap
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
