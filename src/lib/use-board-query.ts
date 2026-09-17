"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

export function useBoardQuery() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setParam = useCallback(
    (key: string, values: string[] | string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (!values || (Array.isArray(values) && values.length === 0)) {
        params.delete(key);
      } else {
        params.set(key, Array.isArray(values) ? values.join(",") : values);
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams],
  );

  const clearAll = useCallback(() => {
    router.push(pathname);
  }, [pathname, router]);

  return { searchParams, setParam, clearAll };
}
