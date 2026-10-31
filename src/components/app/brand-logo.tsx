import { cn } from "@/lib/utils";

export function BrandLogo({
  className,
  imageClassName,
  decorative = false,
}: {
  className?: string;
  imageClassName?: string;
  decorative?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-white p-1 shadow-sm",
        className,
      )}
    >
      <img
        src="/logo-optimized.webp"
        alt={decorative ? "" : "Priority Handling Logistics logo"}
        className={cn("block size-full object-contain", imageClassName)}
        width={768}
        height={768}
        decoding="async"
      />
    </span>
  );
}
