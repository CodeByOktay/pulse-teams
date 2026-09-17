import Link from "next/link";

export type BreadcrumbItem = { label: string; href?: string };

export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav className="flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <span key={`${item.label}-${index}`} className="flex items-center gap-1.5">
            {index > 0 ? <span className="text-zinc-300 dark:text-zinc-600">/</span> : null}
            {item.href && !isLast ? (
              <Link href={item.href} className="hover:text-zinc-700 dark:hover:text-zinc-200">
                {item.label}
              </Link>
            ) : (
              <span
                className={isLast ? "font-medium text-zinc-900 dark:text-zinc-50" : undefined}
              >
                {item.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
