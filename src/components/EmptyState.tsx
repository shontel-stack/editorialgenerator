import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  body?: ReactNode;
  action?: {
    label: string;
    onClick?: () => void;
    href?: string;
  };
  /** Compact variant for narrow side panels. */
  compact?: boolean;
  className?: string;
}

/**
 * On-brand empty state: editorial `font-display` heading, ruby-tinted icon,
 * one primary action. Shared across panels and route views so terse "No X yet."
 * messages give way to a warmer, more directive layout.
 */
export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  compact = false,
  className,
}: EmptyStateProps) {
  const pad = compact ? "px-4 py-6" : "px-6 py-12";
  const iconSize = compact ? "h-6 w-6" : "h-8 w-8";
  const titleSize = compact ? "text-base" : "text-xl md:text-2xl";
  return (
    <div
      className={
        "flex flex-col items-center text-center " +
        pad +
        (className ? " " + className : "")
      }
    >
      {Icon ? (
        <div
          className="mb-3 grid place-items-center rounded-full border border-[color:var(--ruby)]/25 bg-[color:var(--ruby)]/5"
          style={{ width: compact ? 40 : 56, height: compact ? 40 : 56 }}
        >
          <Icon className={`${iconSize} text-[color:var(--ruby)]`} strokeWidth={1.4} />
        </div>
      ) : null}
      <h3
        className={`font-display ${titleSize} tracking-tight text-foreground`}
        style={{ fontFamily: "var(--font-display)" }}
      >
        {title}
      </h3>
      {body ? (
        <p className="mt-2 max-w-sm text-xs md:text-sm leading-relaxed text-muted-foreground">
          {body}
        </p>
      ) : null}
      {action ? (
        <div className="mt-4">
          {action.href ? (
            <a
              href={action.href}
              className="inline-flex items-center gap-2 rounded-sm border border-[color:var(--ruby)]/50 bg-[color:var(--ruby)]/5 px-4 py-2 text-[10px] tracking-[0.3em] uppercase text-[color:var(--ruby-deep)] hover:bg-[color:var(--ruby)]/10 transition"
            >
              {action.label}
            </a>
          ) : (
            <button
              type="button"
              onClick={action.onClick}
              className="inline-flex items-center gap-2 rounded-sm border border-[color:var(--ruby)]/50 bg-[color:var(--ruby)]/5 px-4 py-2 text-[10px] tracking-[0.3em] uppercase text-[color:var(--ruby-deep)] hover:bg-[color:var(--ruby)]/10 transition"
            >
              {action.label}
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
