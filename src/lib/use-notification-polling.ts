"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from "@/actions/notification";

const POLL_INTERVAL_MS = 30_000;

type NotificationList = Awaited<ReturnType<typeof getNotifications>>;

export function useNotificationPolling(): {
  notifications: NotificationList;
  unreadCount: number;
  isLoading: boolean;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refresh: () => Promise<void>;
} {
  const [notifications, setNotifications] = useState<NotificationList>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const unreadCountRef = useRef(0);

  const fetchAll = useCallback(async () => {
    const [list, count] = await Promise.all([
      getNotifications({ limit: 20 }),
      getUnreadNotificationCount(),
    ]);
    setNotifications(list);
    setUnreadCount(count);
    unreadCountRef.current = count;
  }, []);

  const refresh = useCallback(async () => {
    await fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    let isMounted = true;

    (async () => {
      setIsLoading(true);
      const [list, count] = await Promise.all([
        getNotifications({ limit: 20 }),
        getUnreadNotificationCount(),
      ]);
      if (!isMounted) return;
      setNotifications(list);
      setUnreadCount(count);
      unreadCountRef.current = count;
      setIsLoading(false);
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;

    async function poll() {
      const count = await getUnreadNotificationCount();
      if (count !== unreadCountRef.current) {
        const list = await getNotifications({ limit: 20 });
        setNotifications(list);
      }
      setUnreadCount(count);
      unreadCountRef.current = count;
    }

    function startInterval() {
      if (intervalId) return;
      intervalId = setInterval(poll, POLL_INTERVAL_MS);
    }

    function stopInterval() {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        stopInterval();
      } else {
        void poll();
        startInterval();
      }
    }

    startInterval();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      stopInterval();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const markAsRead = useCallback(async (notificationId: string) => {
    await markNotificationAsRead(notificationId);
    setNotifications((prev) =>
      prev.map((notification) =>
        notification.id === notificationId ? { ...notification, read: true } : notification,
      ),
    );
    setUnreadCount((prev) => {
      const next = Math.max(prev - 1, 0);
      unreadCountRef.current = next;
      return next;
    });
  }, []);

  const markAllAsRead = useCallback(async () => {
    await markAllNotificationsAsRead();
    setNotifications((prev) => prev.map((notification) => ({ ...notification, read: true })));
    setUnreadCount(0);
    unreadCountRef.current = 0;
  }, []);

  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    refresh,
  };
}
