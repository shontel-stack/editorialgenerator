import { useCallback, useEffect, useState } from "react";
import {
  addBrandSwatch,
  deleteBrandSwatch,
  listBrandSwatches,
  updateBrandSwatch,
  type BrandSwatch,
} from "@/lib/brandAssets";

export function useBrandSwatches(publicationId: string | null) {
  const [swatches, setSwatches] = useState<BrandSwatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!publicationId) {
      setSwatches([]);
      return;
    }
    setLoading(true);
    try {
      const rows = await listBrandSwatches(publicationId);
      setSwatches(rows);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [publicationId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const add = useCallback(
    async (hex: string, name?: string) => {
      if (!publicationId) throw new Error("Select a publication first.");
      await addBrandSwatch({ publicationId, hex, name });
      await refresh();
    },
    [publicationId, refresh],
  );

  const update = useCallback(
    async (id: string, patch: Partial<Pick<BrandSwatch, "hex" | "name" | "position">>) => {
      await updateBrandSwatch(id, patch);
      await refresh();
    },
    [refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      await deleteBrandSwatch(id);
      await refresh();
    },
    [refresh],
  );

  return { swatches, loading, error, refresh, add, update, remove };
}

export type BrandSwatchesApi = ReturnType<typeof useBrandSwatches>;
