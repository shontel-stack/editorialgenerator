import { type ReactNode } from "react";
import { type LucideIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export type RailItem = {
  key: string;
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  active?: boolean;
  accent?: boolean;
};

/**
 * Shared trigger class for callers embedding their own popovers/triggers
 * as rail children. Matches the look of <RailButton>.
 */
export const RAIL_BUTTON_CLASS =
  "group relative h-10 w-10 flex items-center justify-center rounded-md text-foreground/70 hover:bg-secondary hover:text-foreground transition data-[state=open]:bg-foreground data-[state=open]:text-background";

export function EditorRail({
  items,
  children,
  footerItems = [],
}: {
  items: RailItem[];
  children?: ReactNode;
  footerItems?: RailItem[];
}) {
  return (
    <aside
      aria-label="Editor tools"
      className="fixed left-0 top-[var(--rail-top,4rem)] z-40 hidden md:flex h-[calc(100vh-var(--rail-top,4rem)-var(--statusbar-h,2rem))] w-14 flex-col items-center justify-between border-r border-border bg-card/90 backdrop-blur py-3 overflow-y-auto"
    >
      <TooltipProvider delayDuration={150}>
        <div className="flex flex-col items-center gap-1.5">
          {items.map((it) => (
            <RailButton key={it.key} item={it} />
          ))}
          {children ? (
            <div className="mt-1.5 pt-2 border-t border-border/60 w-8 flex flex-col items-center gap-1.5">
              {children}
            </div>
          ) : null}
        </div>
        <div className="flex flex-col items-center gap-1.5">
          {footerItems.map((it) => (
            <RailButton key={it.key} item={it} />
          ))}
        </div>
      </TooltipProvider>
    </aside>
  );
}

function RailButton({ item }: { item: RailItem }) {
  const Icon = item.icon;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={item.onClick}
          aria-label={item.label}
          aria-pressed={!!item.active}
          className={[
            "group relative h-10 w-10 flex items-center justify-center rounded-md transition",
            item.active
              ? "bg-foreground text-background"
              : item.accent
                ? "bg-[color:var(--ruby)] text-[color:var(--accent-foreground)] hover:bg-[color:var(--ruby-deep)]"
                : "text-foreground/70 hover:bg-secondary hover:text-foreground",
          ].join(" ")}
        >
          <Icon className="h-[18px] w-[18px]" />
          {item.active && (
            <span className="absolute -left-[1px] top-1.5 bottom-1.5 w-[2px] rounded-r bg-[color:var(--ruby)]" />
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" className="text-[11px] tracking-[0.2em] uppercase">
        {item.label}
      </TooltipContent>
    </Tooltip>
  );
}
