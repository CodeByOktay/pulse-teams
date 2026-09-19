"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

export function useBoardQuery() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setParams = useCallback(
    (updates: Record<string, string[] | string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, values] of Object.entries(updates)) {
        if (!values || (Array.isArray(values) && values.length === 0)) {
          params.delete(key);
        } else {
          params.set(key, Array.isArray(values) ? values.join(",") : values);
        }
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams],
  );

  const setParam = useCallback(
    (key: string, values: string[] | string | null) => setParams({ [key]: values }),
    [setParams],
  );

  const clearAll = useCallback(() => {
    router.push(pathname);
  }, [pathname, router]);

  /** Kayıtlı bir görünümü uygularken tüm query string'i tek seferde değiştirir. */
  const applyQueryString = useCallback(
    (query: string) => {
      router.push(query ? `${pathname}?${query}` : pathname);
    },
    [pathname, router],
  );

  return { searchParams, setParam, setParams, clearAll, applyQueryString };
}
