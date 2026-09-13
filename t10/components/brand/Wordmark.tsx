import { clsx } from "@/lib/utils";

/**
 * The T10 brand mark: purely typographic, no asset dependency.
 * The dot is the only ornament - it doubles as a live status indicator in the
 * chat header.
 */
export function Wordmark({
  className,
  showDot = true,
  dotClassName,
}: {
  className?: string;
  showDot?: boolean;
  dotClassName?: string;
}) {
  return (
    <span className={clsx("t10-mark gap-[3px] text-ink", className)}>
      <span>T10</span>
      {showDot && (
        <span
          aria-hidden="true"
          className={clsx("mb-[0.38em] h-[0.2em] w-[0.2em] shrink-0 rounded-full bg-accent", dotClassName)}
        />
      )}
    </span>
  );
}
