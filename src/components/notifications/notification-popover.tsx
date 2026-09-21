"use client";

import { useState } from "react";
import { Settings } from "lucide-react";
import { NotificationItem } from "@/components/notifications/notification-item";
import { NotificationPreferencesModal } from "@/components/notifications/notification-preferences-modal";
import type { getNotifications } from "@/actions/notification";

type NotificationList = Awaited<ReturnType<typeof getNotifications>>;

export function NotificationPopover({
  notifications,
  unreadCount,
  isLoading,
  markAsRead,
  markAllAsRead,
  onClose,
}: {
  notifications: NotificationList;
  unreadCount: number;
  isLoading: boolean;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  onClose: () => void;
}) {
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);

  function handleMarkAllAsRead() {
    if (unreadCount === 0) return;
    void markAllAsRead();
  }

  return (
    <div className="absolute right-0 top-full z-40 mt-2 w-[360px] rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
      <div className="flex items-center justify-between border-b border-zinc-100 px-3 py-2.5 dark:border-zinc-800">
        <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Bildirimler</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleMarkAllAsRead}
            disabled={unreadCount === 0}
            className="text-xs font-medium text-blue-600 hover:underline disabled:cursor-not-allowed disabled:text-zinc-400 disabled:no-underline dark:text-blue-400 dark:disabled:text-zinc-600"
          >
            Tümünü Okundu İşaretle
          </button>
          <button
            type="button"
            onClick={() => setIsPreferencesOpen(true)}
            aria-label="Bildirim Tercihleri"
            className="flex h-6 w-6 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          >
            <Settings className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="max-h-96 overflow-y-auto">
        {isLoading ? (
          <div className="px-3 py-8 text-center text-xs text-zinc-400 dark:text-zinc-500">
            Yükleniyor...
          </div>
        ) : notifications.length === 0 ? (
          <div className="px-3 py-8 text-center text-xs text-zinc-400 dark:text-zinc-500">
            Henüz bildiriminiz yok
          </div>
        ) : (
          notifications.map((notification) => (
            <div key={notification.id} onClick={onClose}>
              <NotificationItem notification={notification} onRead={markAsRead} />
            </div>
          ))
        )}
      </div>

      <NotificationPreferencesModal
        isOpen={isPreferencesOpen}
        onClose={() => setIsPreferencesOpen(false)}
      />
    </div>
  );
}
