/**
 * Editorial calendar — month grid of pages by due date.
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, LayoutGrid } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  listAllPageStatus,
  STATUS_TONES,
  STATUS_LABELS,
  type PageStatusRow,
  type PageStatusValue,
} from "@/lib/pageStatus";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({
    meta: [
      { title: "Editorial calendar — Pageluxe Issue Builder" },
      { name: "description", content: "Month-by-month due dates for every page in production." },
    ],
  }),
  component: CalendarPage,
});

function CalendarPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [rows, setRows] = useState<PageStatusRow[]>([]);
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return { y: d.getFullYear(), m: d.getMonth() };
  });

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setUserId(data.user?.id ?? null);
    })();
  }, []);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const load = () =>
      listAllPageStatus(userId).then((d) => {
        if (!cancelled) setRows(d);
      });
    void load();
    const ch = supabase
      .channel("calendar:page_status")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "page_status" },
        () => void load(),
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [userId]);

  const monthStart = new Date(cursor.y, cursor.m, 1);
  const startWeekday = monthStart.getDay();
  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
  const cells: { date: Date | null; key: string }[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push({ date: null, key: `pad-${i}` });
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: new Date(cursor.y, cursor.m, d), key: `d-${d}` });
  }
  while (cells.length % 7 !== 0) cells.push({ date: null, key: `tail-${cells.length}` });

  const byDate = useMemo(() => {
    const m: Record<string, PageStatusRow[]> = {};
    for (const r of rows) {
      if (!r.due_date) continue;
      (m[r.due_date] ??= []).push(r);
    }
    return m;
  }, [rows]);

  const fmtKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const monthLabel = monthStart.toLocaleString(undefined, { month: "long", year: "numeric" });

  return (
    <div className="min-h-screen bg-background">
      <header className="px-6 py-4 border-b border-border flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to editor
          </Link>
          <div className="h-4 w-px bg-border" />
          <div>
            <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground">Production</div>
            <h1 className="text-lg font-medium">Editorial calendar</h1>
          </div>
        </div>
        <Link to="/board" className="inline-flex items-center gap-2 border border-border px-3 py-2 text-[10px] tracking-[0.3em] uppercase rounded-sm hover:bg-secondary">
          <LayoutGrid className="h-3.5 w-3.5" /> Board
        </Link>
      </header>

      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-medium">{monthLabel}</h2>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCursor((c) => ({ y: c.m === 0 ? c.y - 1 : c.y, m: (c.m + 11) % 12 }))}
              className="p-1.5 rounded-sm hover:bg-secondary border border-border"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => {
                const d = new Date();
                setCursor({ y: d.getFullYear(), m: d.getMonth() });
              }}
              className="px-3 py-1.5 text-xs rounded-sm hover:bg-secondary border border-border"
            >
              Today
            </button>
            <button
              onClick={() => setCursor((c) => ({ y: c.m === 11 ? c.y + 1 : c.y, m: (c.m + 1) % 12 }))}
              className="p-1.5 rounded-sm hover:bg-secondary border border-border"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-px bg-border border border-border">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="bg-background text-[10px] tracking-[0.3em] uppercase text-muted-foreground px-2 py-1">
              {d}
            </div>
          ))}
          {cells.map((c) => {
            const items = c.date ? byDate[fmtKey(c.date)] ?? [] : [];
            return (
              <div key={c.key} className="bg-background min-h-[110px] p-2 text-xs">
                {c.date ? (
                  <>
                    <div className="text-[10px] text-muted-foreground mb-1">{c.date.getDate()}</div>
                    <div className="space-y-1">
                      {items.slice(0, 4).map((r) => (
                        <div
                          key={r.id}
                          className={`truncate px-1.5 py-0.5 rounded-sm text-[10px] ${STATUS_TONES[r.status as PageStatusValue]}`}
                          title={`${r.page_label ?? r.page_id} · ${STATUS_LABELS[r.status as PageStatusValue]}`}
                        >
                          {r.page_label ?? r.page_id}
                        </div>
                      ))}
                      {items.length > 4 ? (
                        <div className="text-[10px] text-muted-foreground">+{items.length - 4} more</div>
                      ) : null}
                    </div>
                  </>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
