"use client";

import { useRef, useState } from "react";
import { Bell } from "lucide-react";
import { NotificationPopover } from "@/components/notifications/notification-popover";
import { useClickOutside } from "@/lib/use-click-outside";
import { useNotificationPolling } from "@/lib/use-notification-polling";

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  useClickOutside(containerRef, () => setIsOpen(false));

  const { notifications, unreadCount, isLoading, markAsRead, markAllAsRead, refresh } =
    useNotificationPolling();

  function toggleOpen() {
    setIsOpen((prev) => {
      const next = !prev;
      if (next) {
        void refresh();
      }
      return next;
    });
  }

  const badgeLabel = unreadCount > 9 ? "9+" : String(unreadCount);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={toggleOpen}
        aria-label="Bildirimler"
        className="relative flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white">
            {badgeLabel}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <NotificationPopover
          notifications={notifications}
          unreadCount={unreadCount}
          isLoading={isLoading}
          markAsRead={markAsRead}
          markAllAsRead={markAllAsRead}
          onClose={() => setIsOpen(false)}
        />
      ) : null}
    </div>
  );
}
