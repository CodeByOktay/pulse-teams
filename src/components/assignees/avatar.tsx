import { getAvatarColor } from "@/lib/colors";

const SIZE_CLASSES = {
  sm: "h-6 w-6 text-[10px]",
  lg: "h-8 w-8 text-xs",
} as const;

export function Avatar({
  name,
  size = "sm",
}: {
  name: string;
  size?: keyof typeof SIZE_CLASSES;
}) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  const color = getAvatarColor(name);

  return (
    <div
      title={name}
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${SIZE_CLASSES[size]}`}
      style={{ backgroundColor: color }}
    >
      {initial}
    </div>
  );
}
