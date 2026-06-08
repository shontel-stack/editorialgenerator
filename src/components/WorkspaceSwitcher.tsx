/**
 * Workspace switcher — dropdown in the editor header that lists the user's
 * publications, lets them switch, create, or edit the page-size of the
 * currently active one.
 */

import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { Building2, CalendarIcon, Check, ChevronDown, Copy, Download, Pencil, Plus, Settings2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useActivePublication } from "@/hooks/useActivePublication";
import { confirmDiscardUnsaved } from "@/lib/unsavedGuards";
import {
  COVER_INCHES,
  DEFAULT_PAGE_MARGINS,
  DIMENSION_PRESETS,
  getPageMargins,
  matchPresetKey,
} from "@/lib/coverDefaults";
import {
  DEFAULT_SCHEDULE_RULES,
  loadScheduleRules,
  normalizeRules,
  saveScheduleRules,
  validateIssueDateAgainstRules,
  type ScheduleRules,
} from "@/lib/scheduleRules";

export function WorkspaceSwitcher() {
  const { publications, active, select, create, update, loading } = useActivePublication();
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [voice, setVoice] = useState("");
  const [masthead, setMasthead] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // dimensions for the create dialog
  const [presetKey, setPresetKey] = useState<string>("pageluxe");
  const [widthIn, setWidthIn] = useState<string>(String(COVER_INCHES.w));
  const [heightIn, setHeightIn] = useState<string>(String(COVER_INCHES.h));
  const [mTop, setMTop] = useState<string>(String(DEFAULT_PAGE_MARGINS.top));
  const [mRight, setMRight] = useState<string>(String(DEFAULT_PAGE_MARGINS.right));
  const [mBottom, setMBottom] = useState<string>(String(DEFAULT_PAGE_MARGINS.bottom));
  const [mLeft, setMLeft] = useState<string>(String(DEFAULT_PAGE_MARGINS.left));
  const [bleed, setBleed] = useState<string>(String(DEFAULT_PAGE_MARGINS.bleed));

  // dimensions for the edit dialog (separate state so opening it doesn't
  // clobber the new-publication form)
  const [editPreset, setEditPreset] = useState<string>("pageluxe");
  const [editWidth, setEditWidth] = useState<string>("");
  const [editHeight, setEditHeight] = useState<string>("");
  const [editMTop, setEditMTop] = useState<string>("");
  const [editMRight, setEditMRight] = useState<string>("");
  const [editMBottom, setEditMBottom] = useState<string>("");
  const [editMLeft, setEditMLeft] = useState<string>("");
  const [editBleed, setEditBleed] = useState<string>("");
  const [editSubmitting, setEditSubmitting] = useState(false);

  const resetCreateForm = () => {
    setName("");
    setTagline("");
    setVoice("");
    setMasthead("");
    setPresetKey("pageluxe");
    setWidthIn(String(COVER_INCHES.w));
    setHeightIn(String(COVER_INCHES.h));
    setMTop(String(DEFAULT_PAGE_MARGINS.top));
    setMRight(String(DEFAULT_PAGE_MARGINS.right));
    setMBottom(String(DEFAULT_PAGE_MARGINS.bottom));
    setMLeft(String(DEFAULT_PAGE_MARGINS.left));
    setBleed(String(DEFAULT_PAGE_MARGINS.bleed));
  };

  // When the edit dialog opens, seed its inputs from the active publication.
  useEffect(() => {
    if (!editOpen || !active) return;
    const w = active.page_width_in ?? COVER_INCHES.w;
    const h = active.page_height_in ?? COVER_INCHES.h;
    setEditWidth(String(w));
    setEditHeight(String(h));
    setEditPreset(matchPresetKey(w, h));
    const m = getPageMargins(active);
    setEditMTop(String(m.top));
    setEditMRight(String(m.right));
    setEditMBottom(String(m.bottom));
    setEditMLeft(String(m.left));
    setEditBleed(String(m.bleed));
  }, [editOpen, active]);

  const onPresetChange = (
    key: string,
    setKey: (k: string) => void,
    setW: (v: string) => void,
    setH: (v: string) => void,
  ) => {
    setKey(key);
    const preset = DIMENSION_PRESETS.find((p) => p.key === key);
    if (preset && preset.key !== "custom") {
      setW(String(preset.w));
      setH(String(preset.h));
    }
  };

  const parseDims = (
    w: string,
    h: string,
  ): { page_width_in: number; page_height_in: number } | null => {
    const wn = parseFloat(w);
    const hn = parseFloat(h);
    if (!isFinite(wn) || !isFinite(hn)) return null;
    if (wn <= 0 || hn <= 0 || wn > 100 || hn > 100) return null;
    return {
      page_width_in: Math.round(wn * 10000) / 10000,
      page_height_in: Math.round(hn * 10000) / 10000,
    };
  };

  const parseMargin = (v: string, fallback: number): number => {
    const n = parseFloat(v);
    if (!isFinite(n) || n < 0 || n > 10) return fallback;
    return Math.round(n * 10000) / 10000;
  };

  const importInputRef = useRef<HTMLInputElement | null>(null);

  const downloadJson = (filename: string, data: unknown) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleExportActive = () => {
    if (!active) return;
    const { id: _id, user_id: _u, created_at: _c, updated_at: _up, ...settings } = active;
    const payload = { kind: "pageluxe.publication", version: 1, settings };
    const slug = active.slug || active.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    downloadJson(`${slug}.publication.json`, payload);
  };

  // Duplicate-for-next-issue dialog state. Using an in-app dialog instead of
  // window.prompt so users get a proper rename step (with the suggested name
  // pre-filled, selected, and editable).
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [duplicateName, setDuplicateName] = useState("");
  const [appendIssueDate, setAppendIssueDate] = useState(false);
  type DateFormat = "month-year" | "year-month" | "iso-date";
  const [dateFormat, setDateFormat] = useState<DateFormat>("month-year");
  const [issueDate, setIssueDate] = useState<Date>(() => new Date());

  // Rename publication dialog state.
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [renaming, setRenaming] = useState(false);

  const openRenameDialog = () => {
    if (!active) return;
    setRenameValue(active.name);
    setRenameOpen(true);
  };

  const confirmRename = async () => {
    if (!active || renaming) return;
    const next = renameValue.trim();
    if (!next || next === active.name) {
      setRenameOpen(false);
      return;
    }
    setRenaming(true);
    try {
      await update(active.id, { name: next });
      setRenameOpen(false);
    } catch (e) {
      alert(`Could not rename publication: ${(e as Error).message}`);
    } finally {
      setRenaming(false);
    }
  };

  // Human-readable suffix for the chosen format and selected issue date.
  const formatIssueDate = (fmt: DateFormat, d: Date): string => {
    switch (fmt) {
      case "month-year":
        return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
      case "year-month":
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      case "iso-date":
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }
  };

  // Strip any previously appended date suffix in any supported format.
  const stripDateSuffix = (s: string): string =>
    s
      .replace(/\s*[—–-]\s*[A-Za-z]+\s+\d{4}\s*$/u, "")
      .replace(/\s*[—–-]\s*\d{4}-\d{2}(?:-\d{2})?\s*$/u, "")
      .trimEnd();

  const openDuplicateDialog = () => {
    if (!active || submitting) return;
    setDuplicateName(`${active.name} (copy)`);
    setAppendIssueDate(false);
    setDateFormat("month-year");
    setIssueDate(new Date());
    setDuplicateOpen(true);
  };

  const applyDateSuffix = (base: string, append: boolean, fmt: DateFormat, d: Date): string => {
    const cleaned = stripDateSuffix(base);
    return append ? `${cleaned} — ${formatIssueDate(fmt, d)}` : cleaned;
  };

  const toggleAppendIssueDate = (next: boolean) => {
    setAppendIssueDate(next);
    setDuplicateName((prev) => applyDateSuffix(prev, next, dateFormat, issueDate));
  };

  const changeDateFormat = (next: DateFormat) => {
    setDateFormat(next);
    if (appendIssueDate) {
      setDuplicateName((prev) => applyDateSuffix(prev, true, next, issueDate));
    }
  };

  const changeIssueDate = (next: Date | undefined) => {
    if (!next) return;
    setIssueDate(next);
    if (appendIssueDate) {
      setDuplicateName((prev) => applyDateSuffix(prev, true, dateFormat, next));
    }
  };

  // Monthly editorial publishing schedule rules — user-configurable via the
  // Schedule settings dialog, persisted in localStorage.
  const [scheduleRules, setScheduleRules] = useState<ScheduleRules>(() => loadScheduleRules());
  const [scheduleOpen, setScheduleOpen] = useState(false);

  const updateScheduleRules = (next: ScheduleRules) => {
    const normalized = normalizeRules(next);
    setScheduleRules(normalized);
    saveScheduleRules(normalized);
  };

  const validateIssueDate = (d: Date): string | null =>
    validateIssueDateAgainstRules(d, scheduleRules);

  const issueDateError = appendIssueDate ? validateIssueDate(issueDate) : null;

  const confirmDuplicate = async () => {
    if (!active || submitting) return;
    if (appendIssueDate && validateIssueDate(issueDate)) return;
    const proposed = duplicateName.trim();
    if (!proposed) return;
    setSubmitting(true);
    try {
      await create({
        name: proposed,
        tagline: active.tagline ?? undefined,
        brand_voice: active.brand_voice ?? undefined,
        masthead: active.masthead ?? undefined,
        display_font: active.display_font ?? undefined,
        body_font: active.body_font ?? undefined,
        palette_key: active.palette_key ?? undefined,
        page_width_in: active.page_width_in,
        page_height_in: active.page_height_in,
        margin_top_in: active.margin_top_in,
        margin_right_in: active.margin_right_in,
        margin_bottom_in: active.margin_bottom_in,
        margin_left_in: active.margin_left_in,
        bleed_in: active.bleed_in,
      });
      setDuplicateOpen(false);
    } catch (e) {
      alert(`Could not duplicate publication: ${(e as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleImportFile = async (file: File | undefined) => {
    if (!file || submitting) return;
    setSubmitting(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as { kind?: string; settings?: Record<string, unknown> };
      const s = (parsed?.settings ?? parsed) as Record<string, unknown>;
      const rawName = typeof s.name === "string" ? s.name : "Imported publication";
      const proposed = window.prompt("Name for the imported publication:", rawName);
      if (!proposed || !proposed.trim()) return;
      const num = (v: unknown): number | null | undefined =>
        v === null || v === undefined ? (v as null | undefined) : Number(v);
      const str = (v: unknown): string | undefined =>
        typeof v === "string" && v.trim() ? v : undefined;
      await create({
        name: proposed.trim(),
        tagline: str(s.tagline),
        brand_voice: str(s.brand_voice),
        masthead: str(s.masthead),
        display_font: str(s.display_font),
        body_font: str(s.body_font),
        palette_key: str(s.palette_key),
        page_width_in: num(s.page_width_in) as number | null | undefined,
        page_height_in: num(s.page_height_in) as number | null | undefined,
        margin_top_in: num(s.margin_top_in) as number | null | undefined,
        margin_right_in: num(s.margin_right_in) as number | null | undefined,
        margin_bottom_in: num(s.margin_bottom_in) as number | null | undefined,
        margin_left_in: num(s.margin_left_in) as number | null | undefined,
        bleed_in: num(s.bleed_in) as number | null | undefined,
      });
    } catch (e) {
      alert(`Could not import publication: ${(e as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreate = async () => {
    if (!name.trim() || submitting) return;
    const dims = parseDims(widthIn, heightIn);
    if (!dims) {
      alert("Page width and height must be positive numbers (max 100 in).");
      return;
    }
    setSubmitting(true);
    try {
      await create({
        name: name.trim(),
        tagline: tagline.trim() || undefined,
        brand_voice: voice.trim() || undefined,
        masthead: masthead.trim() || undefined,
        ...dims,
        margin_top_in:    parseMargin(mTop,    DEFAULT_PAGE_MARGINS.top),
        margin_right_in:  parseMargin(mRight,  DEFAULT_PAGE_MARGINS.right),
        margin_bottom_in: parseMargin(mBottom, DEFAULT_PAGE_MARGINS.bottom),
        margin_left_in:   parseMargin(mLeft,   DEFAULT_PAGE_MARGINS.left),
        bleed_in:         parseMargin(bleed,   DEFAULT_PAGE_MARGINS.bleed),
      });
      setOpen(false);
      resetCreateForm();
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveDims = async () => {
    if (!active || editSubmitting) return;
    const dims = parseDims(editWidth, editHeight);
    if (!dims) {
      alert("Page width and height must be positive numbers (max 100 in).");
      return;
    }
    setEditSubmitting(true);
    try {
      await update(active.id, {
        ...dims,
        margin_top_in:    parseMargin(editMTop,    DEFAULT_PAGE_MARGINS.top),
        margin_right_in:  parseMargin(editMRight,  DEFAULT_PAGE_MARGINS.right),
        margin_bottom_in: parseMargin(editMBottom, DEFAULT_PAGE_MARGINS.bottom),
        margin_left_in:   parseMargin(editMLeft,   DEFAULT_PAGE_MARGINS.left),
        bleed_in:         parseMargin(editBleed,   DEFAULT_PAGE_MARGINS.bleed),
      });
      setEditOpen(false);
    } catch (e) {
      alert(`Could not save dimensions: ${(e as Error).message}`);
    } finally {
      setEditSubmitting(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="inline-flex items-center gap-2 border border-border bg-background px-3 py-2 text-[10px] tracking-[0.3em] uppercase rounded-sm hover:bg-secondary transition max-w-[260px]"
          title="Switch publication"
        >
          <Building2 className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate normal-case tracking-normal text-xs font-medium">
            {loading ? "Loading…" : active?.name ?? "No publication"}
          </span>
          <ChevronDown className="h-3 w-3 opacity-70 shrink-0" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-72">
          <DropdownMenuLabel className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground">
            Publications
          </DropdownMenuLabel>
          {publications.length === 0 ? (
            <div className="px-2 py-3 text-xs text-muted-foreground">
              No publications yet. Create one to scope issues, staff threads, and the board.
            </div>
          ) : (
            publications.map((p) => {
              const w = p.page_width_in ?? COVER_INCHES.w;
              const h = p.page_height_in ?? COVER_INCHES.h;
              return (
                <DropdownMenuItem
                  key={p.id}
                  onClick={async () => {
                    if (p.id === active?.id) return;
                    if (!(await confirmDiscardUnsaved("switch publication"))) return;
                    select(p.id);
                  }}
                  className="flex items-start gap-2"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{p.name}</div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {p.tagline ? `${p.tagline} · ` : ""}
                      {w}″ × {h}″
                    </div>
                  </div>
                  {p.id === active?.id ? <Check className="h-3.5 w-3.5 mt-1" /> : null}
                </DropdownMenuItem>
              );
            })
          )}
          <DropdownMenuSeparator />
          {active ? (
            <>
              <DropdownMenuItem onClick={() => setEditOpen(true)}>
                <Settings2 className="h-3.5 w-3.5 mr-2" /> Edit page size…
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportActive}>
                <Download className="h-3.5 w-3.5 mr-2" /> Save publication to file
              </DropdownMenuItem>
              <DropdownMenuItem onClick={openDuplicateDialog} disabled={submitting}>
                <Copy className="h-3.5 w-3.5 mr-2" /> Duplicate for next issue…
              </DropdownMenuItem>
            </>
          ) : null}
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              importInputRef.current?.click();
            }}
            disabled={submitting}
          >
            <Upload className="h-3.5 w-3.5 mr-2" /> Import publication from file…
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-2" /> New publication
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <input
        ref={importInputRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          void handleImportFile(file);
        }}
      />

      {/* New publication */}
      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) resetCreateForm();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New publication</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Field label="Name" value={name} onChange={setName} placeholder="The Arts Today" />
            <Field
              label="Tagline"
              value={tagline}
              onChange={setTagline}
              placeholder="A quiet monthly on contemporary art"
            />
            <Field
              label="Masthead"
              value={masthead}
              onChange={setMasthead}
              placeholder="Editor-in-Chief, Margaux Hadid"
            />
            <div>
              <label className="block text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-1">
                House voice
              </label>
              <textarea
                value={voice}
                onChange={(e) => setVoice(e.target.value)}
                rows={3}
                placeholder="Describe the voice your staff should write in."
                className="w-full border border-input bg-background px-2.5 py-1.5 text-sm rounded-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <DimensionsForm
              presetKey={presetKey}
              widthIn={widthIn}
              heightIn={heightIn}
              onPresetChange={(k) => onPresetChange(k, setPresetKey, setWidthIn, setHeightIn)}
              onWidthChange={(v) => {
                setWidthIn(v);
                setPresetKey("custom");
              }}
              onHeightChange={(v) => {
                setHeightIn(v);
                setPresetKey("custom");
              }}
            />
            <MarginsForm
              mTop={mTop} mRight={mRight} mBottom={mBottom} mLeft={mLeft} bleed={bleed}
              onTop={setMTop} onRight={setMRight} onBottom={setMBottom}
              onLeft={setMLeft} onBleed={setBleed}
            />
          </div>
          <DialogFooter>
            <button
              onClick={() => setOpen(false)}
              className="text-xs px-3 py-2 rounded-sm hover:bg-secondary"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!name.trim() || submitting}
              className="bg-foreground text-background px-3 py-2 text-[10px] tracking-[0.3em] uppercase rounded-sm disabled:opacity-50"
            >
              {submitting ? "Creating…" : "Create"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit page size */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Page size · {active?.name ?? ""}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Applies to the editor canvas, PDF export, and the InDesign IDML
              page geometry. Changing the aspect ratio of an existing
              publication may shift the position of free-form blocks placed in
              older issues.
            </p>
            <DimensionsForm
              presetKey={editPreset}
              widthIn={editWidth}
              heightIn={editHeight}
              onPresetChange={(k) =>
                onPresetChange(k, setEditPreset, setEditWidth, setEditHeight)
              }
              onWidthChange={(v) => {
                setEditWidth(v);
                setEditPreset("custom");
              }}
              onHeightChange={(v) => {
                setEditHeight(v);
                setEditPreset("custom");
              }}
            />
            <MarginsForm
              mTop={editMTop} mRight={editMRight} mBottom={editMBottom}
              mLeft={editMLeft} bleed={editBleed}
              onTop={setEditMTop} onRight={setEditMRight} onBottom={setEditMBottom}
              onLeft={setEditMLeft} onBleed={setEditBleed}
            />
          </div>
          <DialogFooter>
            <button
              onClick={() => setEditOpen(false)}
              className="text-xs px-3 py-2 rounded-sm hover:bg-secondary"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveDims}
              disabled={editSubmitting || !active}
              className="bg-foreground text-background px-3 py-2 text-[10px] tracking-[0.3em] uppercase rounded-sm disabled:opacity-50"
            >
              {editSubmitting ? "Saving…" : "Save"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Duplicate for next issue — rename step */}
      <Dialog open={duplicateOpen} onOpenChange={(o) => !submitting && setDuplicateOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Duplicate publication</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Create a copy of <span className="font-medium text-foreground">{active?.name}</span> for
              your next issue. All settings (fonts, palette, page size, margins) are carried over.
              Issues themselves are not copied.
            </p>
            <div>
              <label className="block text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-1">
                New publication name
              </label>
              <input
                autoFocus
                value={duplicateName}
                onChange={(e) => setDuplicateName(e.target.value)}
                onFocus={(e) => e.currentTarget.select()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && duplicateName.trim() && !submitting) {
                    e.preventDefault();
                    void confirmDuplicate();
                  }
                }}
                placeholder="e.g. The Arts Today — March 2026"
                className="w-full border border-input bg-background px-2.5 py-1.5 text-sm rounded-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="space-y-2">
              <label className="flex items-start gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={appendIssueDate}
                  onChange={(e) => toggleAppendIssueDate(e.target.checked)}
                  className="mt-0.5 h-3.5 w-3.5 accent-foreground cursor-pointer"
                />
                <span>
                  Append issue date{" "}
                  <span className="text-foreground">
                    ({formatIssueDate(dateFormat, issueDate)})
                  </span>{" "}
                  to the name
                </span>
              </label>
              <div className="pl-6 grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-1">
                    Issue date
                  </label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={!appendIssueDate}
                        className={cn(
                          "w-full justify-start text-left font-normal h-9 px-2.5 text-sm",
                          !issueDate && "text-muted-foreground",
                        )}
                      >
                        <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                        {issueDate ? format(issueDate, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={issueDate}
                        onSelect={changeIssueDate}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <label className="block text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-1">
                    Date format
                  </label>
                  <select
                    value={dateFormat}
                    onChange={(e) => changeDateFormat(e.target.value as typeof dateFormat)}
                    disabled={!appendIssueDate}
                    className="w-full h-9 border border-input bg-background px-2.5 text-sm rounded-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
                  >
                    <option value="month-year">Month YYYY</option>
                    <option value="year-month">YYYY-MM</option>
                    <option value="iso-date">YYYY-MM-DD</option>
                  </select>
                </div>
              </div>
              {issueDateError ? (
                <p
                  role="alert"
                  className="pl-6 text-[11px] leading-relaxed text-destructive"
                >
                  {issueDateError}
                </p>
              ) : null}
              <div className="pl-6 pt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>
                  Allowed: day {scheduleRules.minDay}–{scheduleRules.maxDay}, −
                  {scheduleRules.pastMonths} / +{scheduleRules.futureMonths} months
                </span>
                <button
                  type="button"
                  onClick={() => setScheduleOpen(true)}
                  className="underline underline-offset-2 hover:text-foreground"
                >
                  Configure schedule…
                </button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <button
              onClick={() => setDuplicateOpen(false)}
              disabled={submitting}
              className="text-xs px-3 py-2 rounded-sm hover:bg-secondary disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={() => void confirmDuplicate()}
              disabled={!duplicateName.trim() || submitting || !!issueDateError}
              className="bg-foreground text-background px-3 py-2 text-[10px] tracking-[0.3em] uppercase rounded-sm disabled:opacity-50"
            >
              {submitting ? "Duplicating…" : "Duplicate"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SchedulePanel
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        rules={scheduleRules}
        onChange={updateScheduleRules}
      />
    </>
  );
}

function DimensionsForm({
  presetKey,
  widthIn,
  heightIn,
  onPresetChange,
  onWidthChange,
  onHeightChange,
}: {
  presetKey: string;
  widthIn: string;
  heightIn: string;
  onPresetChange: (k: string) => void;
  onWidthChange: (v: string) => void;
  onHeightChange: (v: string) => void;
}) {
  return (
    <div className="border-t border-border pt-3 space-y-2">
      <label className="block text-[10px] tracking-[0.3em] uppercase text-muted-foreground">
        Page size
      </label>
      <select
        value={presetKey}
        onChange={(e) => onPresetChange(e.target.value)}
        className="w-full border border-input bg-background px-2.5 py-1.5 text-sm rounded-sm focus:outline-none focus:ring-1 focus:ring-ring"
      >
        {DIMENSION_PRESETS.map((p) => (
          <option key={p.key} value={p.key}>
            {p.label}
          </option>
        ))}
      </select>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-1">
            Width (in)
          </label>
          <input
            type="number"
            step="0.0001"
            min="0.5"
            max="100"
            value={widthIn}
            onChange={(e) => onWidthChange(e.target.value)}
            className="w-full border border-input bg-background px-2.5 py-1.5 text-sm rounded-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div>
          <label className="block text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-1">
            Height (in)
          </label>
          <input
            type="number"
            step="0.0001"
            min="0.5"
            max="100"
            value={heightIn}
            onChange={(e) => onHeightChange(e.target.value)}
            className="w-full border border-input bg-background px-2.5 py-1.5 text-sm rounded-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-1">
        {label}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-input bg-background px-2.5 py-1.5 text-sm rounded-sm focus:outline-none focus:ring-1 focus:ring-ring"
      />
    </div>
  );
}

function MarginsForm({
  mTop, mRight, mBottom, mLeft, bleed,
  onTop, onRight, onBottom, onLeft, onBleed,
}: {
  mTop: string; mRight: string; mBottom: string; mLeft: string; bleed: string;
  onTop: (v: string) => void;
  onRight: (v: string) => void;
  onBottom: (v: string) => void;
  onLeft: (v: string) => void;
  onBleed: (v: string) => void;
}) {
  return (
    <div className="border-t border-border pt-3 space-y-2">
      <div>
        <label className="block text-[10px] tracking-[0.3em] uppercase text-muted-foreground">
          Margins (safe area)
        </label>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          In inches. Carried into the InDesign IDML page geometry and the Canva README.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <MarginInput label="Top" value={mTop} onChange={onTop} />
        <MarginInput label="Right" value={mRight} onChange={onRight} />
        <MarginInput label="Bottom" value={mBottom} onChange={onBottom} />
        <MarginInput label="Left" value={mLeft} onChange={onLeft} />
      </div>
      <div>
        <label className="block text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-1">
          Bleed (in, all edges)
        </label>
        <input
          type="number"
          step="0.0001"
          min="0"
          max="2"
          value={bleed}
          onChange={(e) => onBleed(e.target.value)}
          className="w-full border border-input bg-background px-2.5 py-1.5 text-sm rounded-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <p className="text-[11px] text-muted-foreground mt-1">
          Standard print bleed is 0.125 in (3.175 mm). Sets InDesign's
          DocumentBleed and the Canva crop instructions in the export README.
        </p>
      </div>
    </div>
  );
}

function MarginInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-1">
        {label}
      </label>
      <input
        type="number"
        step="0.0001"
        min="0"
        max="10"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-input bg-background px-2.5 py-1.5 text-sm rounded-sm focus:outline-none focus:ring-1 focus:ring-ring"
      />
    </div>
  );
}

/**
 * Settings panel for the monthly editorial publishing schedule rules used
 * to validate the chosen "Issue Date" when duplicating a publication.
 */
function SchedulePanel({
  open,
  onOpenChange,
  rules,
  onChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rules: ScheduleRules;
  onChange: (next: ScheduleRules) => void;
}) {
  const [draft, setDraft] = useState<ScheduleRules>(rules);

  useEffect(() => {
    if (open) setDraft(rules);
  }, [open, rules]);

  const dayError =
    draft.minDay < 1 || draft.minDay > 31 || draft.maxDay < 1 || draft.maxDay > 31
      ? "Days must be between 1 and 31."
      : draft.minDay > draft.maxDay
      ? "Minimum day cannot be greater than maximum day."
      : null;
  const offsetError =
    draft.pastMonths < 0 || draft.futureMonths < 0
      ? "Month offsets cannot be negative."
      : draft.pastMonths > 120 || draft.futureMonths > 120
      ? "Month offsets must be 120 or less."
      : null;
  const invalid = !!dayError || !!offsetError;

  const setField = (k: keyof ScheduleRules, v: string) => {
    const n = v === "" ? 0 : Number(v);
    setDraft((d) => ({ ...d, [k]: Number.isFinite(n) ? n : 0 }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Publishing schedule rules</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            These rules are used to validate the “Issue Date” you pick when
            duplicating a publication for a new monthly issue.
          </p>

          <div>
            <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-1">
              Allowed days of month
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-muted-foreground mb-1">Earliest day</label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={draft.minDay}
                  onChange={(e) => setField("minDay", e.target.value)}
                  className="w-full border border-input bg-background px-2.5 py-1.5 text-sm rounded-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div>
                <label className="block text-[10px] text-muted-foreground mb-1">Latest day</label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={draft.maxDay}
                  onChange={(e) => setField("maxDay", e.target.value)}
                  className="w-full border border-input bg-background px-2.5 py-1.5 text-sm rounded-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>
            {dayError ? (
              <p role="alert" className="mt-1 text-[11px] text-destructive">
                {dayError}
              </p>
            ) : null}
          </div>

          <div>
            <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-1">
              Allowed month offset (from today)
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-muted-foreground mb-1">
                  Months in the past
                </label>
                <input
                  type="number"
                  min={0}
                  max={120}
                  value={draft.pastMonths}
                  onChange={(e) => setField("pastMonths", e.target.value)}
                  className="w-full border border-input bg-background px-2.5 py-1.5 text-sm rounded-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div>
                <label className="block text-[10px] text-muted-foreground mb-1">
                  Months in the future
                </label>
                <input
                  type="number"
                  min={0}
                  max={120}
                  value={draft.futureMonths}
                  onChange={(e) => setField("futureMonths", e.target.value)}
                  className="w-full border border-input bg-background px-2.5 py-1.5 text-sm rounded-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>
            {offsetError ? (
              <p role="alert" className="mt-1 text-[11px] text-destructive">
                {offsetError}
              </p>
            ) : null}
          </div>

          <SchedulePreview draft={draft} invalid={invalid} />
        </div>
        <DialogFooter>
          <button
            type="button"
            onClick={() => {
              // One-click undo: apply defaults to the draft, persist them
              // immediately, and reflect that in the parent state. The user
              // can still tweak further before closing.
              setDraft(DEFAULT_SCHEDULE_RULES);
              onChange(DEFAULT_SCHEDULE_RULES);
            }}
            className="text-xs px-3 py-2 rounded-sm hover:bg-secondary mr-auto border border-input"
            title="Restore the default day range and month offsets"
          >
            Reset schedule to defaults
          </button>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="text-xs px-3 py-2 rounded-sm hover:bg-secondary"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              if (invalid) return;
              onChange(draft);
              onOpenChange(false);
            }}
            disabled={invalid}
            className="bg-foreground text-background px-3 py-2 text-[10px] tracking-[0.3em] uppercase rounded-sm disabled:opacity-50"
          >
            Save
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Live preview of which day-of-month values and which date window the
 * current (draft) schedule rules allow. Updates as the user edits inputs.
 */
function SchedulePreview({ draft, invalid }: { draft: ScheduleRules; invalid: boolean }) {
  if (invalid) {
    return (
      <div className="border border-dashed border-input rounded-sm p-3 text-[11px] text-muted-foreground">
        Fix the errors above to see a preview of allowed dates.
      </div>
    );
  }

  const days: number[] = [];
  for (let d = draft.minDay; d <= draft.maxDay; d += 1) days.push(d);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const minDate = new Date(today);
  minDate.setMonth(minDate.getMonth() - draft.pastMonths);
  const maxDate = new Date(today);
  maxDate.setMonth(maxDate.getMonth() + draft.futureMonths);

  const fmtDate = (d: Date) =>
    d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  const fmtMonth = (d: Date) =>
    d.toLocaleDateString(undefined, { month: "short", year: "numeric" });

  return (
    <div className="border border-input rounded-sm p-3 space-y-3 bg-secondary/40">
      <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground">
        Live preview
      </div>

      <div>
        <div className="text-[11px] text-muted-foreground mb-1.5">
          Allowed days of month ({days.length})
        </div>
        <div className="flex flex-wrap gap-1">
          {days.map((d) => (
            <span
              key={d}
              className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1 text-[10px] font-medium rounded-sm bg-background border border-input text-foreground"
            >
              {d}
            </span>
          ))}
        </div>
      </div>

      <div>
        <div className="text-[11px] text-muted-foreground mb-1.5">Allowed date window</div>
        <div className="text-xs text-foreground">
          <span className="font-medium">{fmtDate(minDate)}</span>{" "}
          <span className="text-muted-foreground">→</span>{" "}
          <span className="font-medium">{fmtDate(maxDate)}</span>
        </div>
        <div className="mt-1 text-[11px] text-muted-foreground">
          {fmtMonth(minDate)} through {fmtMonth(maxDate)} ({draft.pastMonths + draft.futureMonths + 1} months)
        </div>
      </div>
    </div>
  );
}
