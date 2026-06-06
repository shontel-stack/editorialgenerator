/**
 * Tracks the current user's publications and which one is "active".
 * The active publication drives defaults for new issues, scopes the
 * production board, and (in later phases) shapes staff prompts.
 */

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  createPublication,
  getActivePublicationId,
  listPublications,
  setActivePublicationId,
  updatePublication,
  type Publication,
  type PublicationInput,
} from "@/lib/publications";

export function useActivePublication() {
  const [userId, setUserId] = useState<string | null>(null);
  const [publications, setPublications] = useState<Publication[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!active) return;
      setUserId(data.user?.id ?? null);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const [pubs, current] = await Promise.all([
        listPublications(userId),
        getActivePublicationId(userId),
      ]);
      setPublications(pubs);
      const fallback = current ?? pubs[0]?.id ?? null;
      setActiveId(fallback);
      if (!current && fallback) {
        await setActivePublicationId(userId, fallback);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) void refresh();
  }, [userId, refresh]);

  const select = useCallback(
    async (id: string | null) => {
      if (!userId) return;
      setActiveId(id);
      await setActivePublicationId(userId, id);
    },
    [userId],
  );

  const create = useCallback(
    async (input: PublicationInput, makeActive = true): Promise<Publication | null> => {
      if (!userId) return null;
      const pub = await createPublication(userId, input);
      setPublications((prev) => [...prev, pub]);
      if (makeActive) await select(pub.id);
      return pub;
    },
    [userId, select],
  );

  const active = publications.find((p) => p.id === activeId) ?? null;

  return { userId, publications, active, activeId, loading, error, refresh, select, create };
}
