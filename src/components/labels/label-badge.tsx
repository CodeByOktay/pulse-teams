export function LabelBadge({ name, color }: { name: string; color: string }) {
  return (
    <span
      className="inline-flex max-w-[96px] items-center truncate rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
      style={{ backgroundColor: color }}
      title={name}
    >
      {name}
    </span>
  );
}
