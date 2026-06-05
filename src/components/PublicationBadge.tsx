/**
 * Clickable publication badge — opens the publication switcher dropdown.
 * Used in the Staff drawer, Inbox, and Attachments panel so the active
 * publication is always visible and one click away from being changed.
 */

import { useState } from "react";
import { Check, ChevronDown, Plus } from "lucide-react";
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

interface PublicationBadgeProps {
  /** Optional override for the displayed name. Falls back to the active publication. */
  name?: string | null;
  /** Tweak the max width of the label. */
  maxWidthClass?: string;
}

export function PublicationBadge({ name, maxWidthClass = "max-w-[160px]" }: PublicationBadgeProps) {
  const { publications, active, select, create, loading } = useActivePublication();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [tagline, setTagline] = useState("");
  const [voice, setVoice] = useState("");
  const [masthead, setMasthead] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const label = name ?? active?.name ?? (loading ? "Loading…" : "No publication");

  const handleCreate = async () => {
    if (!newName.trim() || submitting) return;
    setSubmitting(true);
    try {
      await create({
        name: newName.trim(),
        tagline: tagline.trim() || undefined,
        brand_voice: voice.trim() || undefined,
        masthead: masthead.trim() || undefined,
      });
      setDialogOpen(false);
      setNewName("");
      setTagline("");
      setVoice("");
      setMasthead("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          title={`Publication: ${label} — click to switch`}
          className={`inline-flex ${maxWidthClass} items-center gap-1.5 rounded-sm border border-border bg-secondary/60 px-2 py-1 text-[10px] tracking-[0.2em] uppercase text-muted-foreground hover:bg-secondary hover:text-foreground transition`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--ruby)] shrink-0" />
          <span className="truncate normal-case tracking-normal text-foreground">{label}</span>
          <ChevronDown className="h-3 w-3 opacity-70 shrink-0" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuLabel className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground">
            Publications
          </DropdownMenuLabel>
          {publications.length === 0 ? (
            <div className="px-2 py-3 text-xs text-muted-foreground">
              No publications yet. Create one to scope issues, staff threads, and the board.
            </div>
          ) : (
            publications.map((p) => (
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
                  {p.tagline ? (
                    <div className="text-[11px] text-muted-foreground truncate">{p.tagline}</div>
                  ) : null}
                </div>
                {p.id === active?.id ? <Check className="h-3.5 w-3.5 mt-1" /> : null}
              </DropdownMenuItem>
            ))
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setDialogOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-2" /> New publication
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New publication</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Field label="Name" value={newName} onChange={setNewName} placeholder="The Arts Today" />
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
                rows={4}
                placeholder="Describe the voice your staff should write in."
                className="w-full border border-input bg-background px-2.5 py-1.5 text-sm rounded-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>
          <DialogFooter>
            <button
              onClick={() => setDialogOpen(false)}
              className="text-xs px-3 py-2 rounded-sm hover:bg-secondary"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!newName.trim() || submitting}
              className="bg-foreground text-background px-3 py-2 text-[10px] tracking-[0.3em] uppercase rounded-sm disabled:opacity-50"
            >
              {submitting ? "Creating…" : "Create"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
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
