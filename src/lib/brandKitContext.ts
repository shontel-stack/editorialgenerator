import { createContext, useContext } from "react";
import type { BrandFont, BrandSwatch } from "@/lib/brandAssets";

/**
 * Lightweight read-only context so deeply-nested editor components (text
 * block toolbars, image block bg pickers, etc.) can access the active
 * publication's brand fonts and color swatches without prop-drilling.
 */
export type BrandKitContextValue = {
  fonts: BrandFont[];
  swatches: BrandSwatch[];
  resolveFontCssFamily: (id: string) => string | null;
  saveSwatch?: (hex: string) => Promise<void> | void;
  removeSwatch?: (id: string) => Promise<void> | void;
};

const Ctx = createContext<BrandKitContextValue>({
  fonts: [],
  swatches: [],
  resolveFontCssFamily: () => null,
});

export const BrandKitProvider = Ctx.Provider;

export function useBrandKit(): BrandKitContextValue {
  return useContext(Ctx);
}
