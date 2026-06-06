/**
 * Loads and live-syncs the current user's saved layout presets
 * (column widths + gutter scoped to a page layout family).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  listLayoutPresets,
  createLayoutPreset,
  deleteLayoutPreset,
  type LayoutPresetRow,
} from "@/lib/layoutPresets";
import type { PageLayout } from "@/lib/pageLayouts";

export function useLayoutPresets(userId: string | null) {
  const [presets, setPresets] = useState<LayoutPresetRow[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      setPresets(await listLayoutPresets(userId));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`layout-presets:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "layout_presets", filter: `user_id=eq.${userId}` },
        () => void reload(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, reload]);

  const byLayout = useMemo(() => {
    const m: Record<string, LayoutPresetRow[]> = {};
    for (const p of presets) (m[p.layout] ??= []).push(p);
    return m;
  }, [presets]);

  const presetsFor = useCallback(
    (layout: PageLayout) => byLayout[layout] ?? [],
    [byLayout],
  );

  const save = useCallback(
    async (input: {
      name: string;
      layout: PageLayout;
      column_widths: number[];
      gutter_in: number;
    }) => {
      if (!userId) return;
      await createLayoutPreset({ userId, ...input });
    },
    [userId],
  );

  const remove = useCallback(async (id: string) => {
    await deleteLayoutPreset(id);
  }, []);

  return { presets, byLayout, presetsFor, loading, reload, save, remove };
}
