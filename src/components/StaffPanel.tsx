import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { supabase } from "@/integrations/supabase/client";
import { snapshotIssue } from "@/lib/issue-snapshot";
import type { IssueDoc } from "@/lib/coverDefaults";
import { STAFF_ROLES, STAFF_BY_ID, type StaffRole } from "@/lib/staffRoles";
import { ChevronLeft, X, Users, Inbox, Check, Trash2, Flag, FileEdit, MessageSquare, GitBranch, MapPin } from "lucide-react";
import { PublicationBadge } from "@/components/PublicationBadge";

/* ------------------------------------------------------------------ */
/*                              Types                                   */
/* ------------------------------------------------------------------ */

type NoteType = "comment" | "edit_suggestion" | "status_change" | "flag";
type NoteStatus = "open" | "resolved" | "dismissed";

type StaffNote = {
  id: string;
  issue_id: string;
  page_id: string | null;
  thread_id: string | null;
  role: string;
  type: NoteType;
  title: string;
  body: string | null;
  payload: Record<string, unknown>;
  status: NoteStatus;
  created_at: string;
};

type NoteToolOutput = {
  kind: "note";
  type: NoteType;
  title: string;
  body?: string;
  page_id?: string;
  severity?: "low" | "med" | "high";
};

export type AttachmentBrief = {
  id: string;
  file_name: string;
  mime_type: string;
  kind: "template" | "reference";
  page_id: string | null;
  region: string | null;
  position_x: number | null;
  position_y: number | null;
};

export type PlacementPatch = {
  page_id?: string | null;
  region?: string | null;
  position_x?: number | null;
  position_y?: number | null;
};

type PlacementToolOutput = {
  kind: "placement";
  attachment_id: string;
  page_id: string;
  region?: string | null;
  position_x?: number | null;
  position_y?: number | null;
  rationale?: string;
};

/* ------------------------------------------------------------------ */
/*                              Drawer shell                            */
/* ------------------------------------------------------------------ */

export function StaffPanel({
  open,
  onClose,
  issue,
  publicationId,
  publicationName,
  selectedPageId,
  attachments,
  onPlaceAttachment,
}: {
  open: boolean;
  onClose: () => void;
  issue: IssueDoc;
  publicationId: string | null;
  publicationName?: string | null;
  selectedPageId: string;
  attachments?: AttachmentBrief[];
  onPlaceAttachment?: (id: string, patch: PlacementPatch) => Promise<void> | void;
}) {
  const [activeRoleId, setActiveRoleId] = useState<string | null>(null);
  const [view, setView] = useState<"masthead" | "inbox">("masthead");
  const activeRole = activeRoleId ? STAFF_ROLES.find((r) => r.id === activeRoleId) ?? null : null;

  // Reset when the panel closes.
  useEffect(() => {
    if (!open) {
      setActiveRoleId(null);
      setView("masthead");
    }
  }, [open]);

  if (!open) return null;

  return (
    <aside
      className="fixed inset-y-0 right-0 z-40 w-full max-w-[560px] border-l border-border bg-background shadow-2xl flex flex-col"
      aria-label="Editorial staff"
    >
      <header className="flex items-center justify-between border-b border-border px-5 py-4">
        <div className="flex items-center gap-3 min-w-0">
          {activeRole ? (
            <>
              <button
                type="button"
                onClick={() => setActiveRoleId(null)}
                className="inline-flex items-center gap-1 text-[10px] tracking-[0.25em] uppercase text-muted-foreground hover:text-foreground"
                title="Back to staff list"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Masthead
              </button>
              <div className="h-4 w-px bg-border" />
              <div className="min-w-0">
                <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground">
                  {activeRole.title}
                </div>
                <div className="text-sm font-medium truncate">{activeRole.name}</div>
              </div>
            </>
          ) : (
            <>
              {view === "inbox" ? (
                <Inbox className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Users className="h-4 w-4 text-muted-foreground" />
              )}
              <div>
                <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground">
                  Editorial &amp; Marketing
                </div>
                <div className="text-sm font-medium">
                  {view === "inbox" ? "Shared Inbox" : "Masthead"}
                </div>
              </div>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <PublicationBadge name={publicationName} />
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      {!activeRole && (
        <div className="flex border-b border-border text-[10px] tracking-[0.3em] uppercase">
          <TabButton active={view === "masthead"} onClick={() => setView("masthead")}>
            Masthead
          </TabButton>
          <TabButton active={view === "inbox"} onClick={() => setView("inbox")}>
            Inbox
          </TabButton>
        </div>
      )}

      {activeRole ? (
        <StaffChat
          key={`${issue.meta.issueId}:${publicationId ?? "_none"}:${activeRole.id}`}
          role={activeRole}
          issue={issue}
          publicationId={publicationId}
          selectedPageId={selectedPageId}
          attachments={attachments}
          onPlaceAttachment={onPlaceAttachment}
        />
      ) : view === "inbox" ? (
        <InboxView
          issueId={issue.meta.issueId}
          publicationId={publicationId}
          publicationName={publicationName}
        />
      ) : (
        <StaffRoster
          issueId={issue.meta.issueId}
          publicationId={publicationId}
          onPick={(id) => setActiveRoleId(id)}
        />
      )}
    </aside>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 px-4 py-3 transition border-b-2 ${
        active
          ? "text-foreground border-foreground"
          : "text-muted-foreground border-transparent hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*                              Roster grid                             */
/* ------------------------------------------------------------------ */

function StaffRoster({
  issueId,
  publicationId,
  onPick,
}: {
  issueId: string;
  publicationId: string | null;
  onPick: (roleId: string) => void;
}) {
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return;
      let q = supabase
        .from("staff_threads")
        .select("role, id")
        .eq("issue_id", issueId)
        .eq("user_id", uid);
      q = publicationId === null
        ? q.is("publication_id", null)
        : q.eq("publication_id", publicationId);
      const { data, error } = await q;
      if (error || cancelled || !data) return;
      const threadIds = data.map((t) => t.id);
      const roleById = Object.fromEntries(data.map((t) => [t.id, t.role]));
      if (!threadIds.length) {
        setCounts({});
        return;
      }
      const { data: msgs } = await supabase
        .from("staff_messages")
        .select("thread_id")
        .in("thread_id", threadIds);
      if (cancelled || !msgs) return;
      const map: Record<string, number> = {};
      for (const m of msgs) {
        const role = roleById[m.thread_id as string];
        if (!role) continue;
        map[role] = (map[role] ?? 0) + 1;
      }
      setCounts(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [issueId, publicationId]);

  const editorial = STAFF_ROLES.filter((r) => r.department === "Editorial");
  const marketing = STAFF_ROLES.filter((r) => r.department === "Marketing");

  return (
    <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
      <RoleSection title="Editorial" roles={editorial} counts={counts} onPick={onPick} />
      <RoleSection title="Marketing &amp; Growth" roles={marketing} counts={counts} onPick={onPick} />
      <p className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground pt-2 border-t border-border">
        Each staff member has the current issue snapshot. Threads are private to you and persist between sessions.
      </p>
    </div>
  );
}

function RoleSection({
  title,
  roles,
  counts,
  onPick,
}: {
  title: string;
  roles: StaffRole[];
  counts: Record<string, number>;
  onPick: (id: string) => void;
}) {
  return (
    <section>
      <h3
        className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-3"
        dangerouslySetInnerHTML={{ __html: title }}
      />
      <ul className="space-y-2">
        {roles.map((r) => {
          const count = counts[r.id] ?? 0;
          return (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => onPick(r.id)}
                className="w-full text-left flex items-start gap-3 rounded-sm border border-border bg-card px-4 py-3 hover:border-foreground/40 hover:bg-secondary transition"
              >
                <RoleAvatar role={r} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="font-medium text-sm truncate">{r.name}</div>
                    {count > 0 && (
                      <span className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground shrink-0">
                        {count} {count === 1 ? "msg" : "msgs"}
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] tracking-[0.25em] uppercase text-muted-foreground">
                    {r.title}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{r.tagline}</p>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function RoleAvatar({ role }: { role: StaffRole }) {
  const initials = role.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div className="h-10 w-10 shrink-0 rounded-full bg-[color:var(--ruby)]/10 border border-[color:var(--ruby)]/30 flex items-center justify-center text-[11px] tracking-[0.15em] text-[color:var(--ruby-deep)] font-medium">
      {initials}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*                              Inbox view                              */
/* ------------------------------------------------------------------ */

const NOTE_ICONS: Record<NoteType, typeof Flag> = {
  comment: MessageSquare,
  edit_suggestion: FileEdit,
  status_change: GitBranch,
  flag: Flag,
};

const NOTE_LABELS: Record<NoteType, string> = {
  comment: "Comment",
  edit_suggestion: "Edit",
  status_change: "Status",
  flag: "Flag",
};

function InboxView({
  issueId,
  publicationId,
  publicationName,
}: {
  issueId: string;
  publicationId: string | null;
  publicationName?: string | null;
}) {
  const [notes, setNotes] = useState<StaffNote[] | null>(null);
  const [filter, setFilter] = useState<NoteStatus>("open");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) {
      setNotes([]);
      return;
    }
    let q = supabase
      .from("staff_notes")
      .select("*")
      .eq("user_id", uid)
      .eq("issue_id", issueId);
    q = publicationId === null
      ? q.is("publication_id", null)
      : q.eq("publication_id", publicationId);
    const { data, error } = await q.order("created_at", { ascending: false });
    if (error) {
      console.warn("[inbox] load failed", error.message);
      setNotes([]);
      return;
    }
    setNotes((data ?? []) as StaffNote[]);
  }, [issueId, publicationId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Realtime: refresh on any change to staff_notes for this issue/publication.
  useEffect(() => {
    const channel = supabase
      .channel(`staff_notes:${issueId}:${publicationId ?? "_none"}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "staff_notes" },
        () => void load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [issueId, publicationId, load]);

  const setStatus = async (id: string, status: NoteStatus) => {
    setBusy(id);
    const { error } = await supabase.from("staff_notes").update({ status }).eq("id", id);
    setBusy(null);
    if (error) console.warn("[inbox] update failed", error.message);
    else void load();
  };

  const remove = async (id: string) => {
    setBusy(id);
    const { error } = await supabase.from("staff_notes").delete().eq("id", id);
    setBusy(null);
    if (error) console.warn("[inbox] delete failed", error.message);
    else void load();
  };

  const filtered = (notes ?? []).filter((n) => n.status === filter);
  const counts = (notes ?? []).reduce<Record<NoteStatus, number>>(
    (acc, n) => {
      acc[n.status] = (acc[n.status] ?? 0) + 1;
      return acc;
    },
    { open: 0, resolved: 0, dismissed: 0 },
  );

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-5 pt-4 pb-1 flex items-center gap-2 text-[10px] tracking-[0.25em] uppercase text-muted-foreground">
        <Inbox className="h-3 w-3" />
        <span>Inbox for</span>
        <PublicationBadge name={publicationName} />
      </div>
      <div className="flex gap-2 px-5 pt-2 pb-2 text-[10px] tracking-[0.25em] uppercase">
        {(["open", "resolved", "dismissed"] as NoteStatus[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            className={`px-2 py-1 rounded-sm transition ${
              filter === s
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {s} · {counts[s] ?? 0}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-5 pt-2">
        {notes === null ? (
          <p className="text-xs tracking-[0.25em] uppercase text-muted-foreground py-8 text-center">
            Loading…
          </p>
        ) : filtered.length === 0 ? (
          <p className="text-xs tracking-[0.25em] uppercase text-muted-foreground py-8 text-center">
            No {filter} notes yet.
            {filter === "open" && (
              <span className="block normal-case tracking-normal text-[11px] mt-2 text-muted-foreground/70">
                Ask a staff member for a critique or edit — they'll file actionable items here.
              </span>
            )}
          </p>
        ) : (
          <ul className="space-y-2">
            {filtered.map((n) => {
              const role = STAFF_BY_ID[n.role];
              const Icon = NOTE_ICONS[n.type] ?? MessageSquare;
              return (
                <li
                  key={n.id}
                  className="rounded-sm border border-border bg-card px-4 py-3 group"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 text-muted-foreground">
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center flex-wrap gap-x-2 gap-y-1 text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
                        <span>{NOTE_LABELS[n.type]}</span>
                        {role && (
                          <>
                            <span>·</span>
                            <span>{role.title}</span>
                          </>
                        )}
                        {n.page_id && (
                          <>
                            <span>·</span>
                            <span className="font-mono normal-case tracking-normal">{n.page_id}</span>
                          </>
                        )}
                      </div>
                      <div className="text-sm font-medium mt-1">{n.title}</div>
                      {n.body && (
                        <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">
                          {n.body}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                      {n.status === "open" && (
                        <>
                          <button
                            type="button"
                            disabled={busy === n.id}
                            onClick={() => void setStatus(n.id, "resolved")}
                            className="p-1.5 text-muted-foreground hover:text-foreground"
                            title="Resolve"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={busy === n.id}
                            onClick={() => void setStatus(n.id, "dismissed")}
                            className="p-1.5 text-muted-foreground hover:text-foreground"
                            title="Dismiss"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                      {n.status !== "open" && (
                        <button
                          type="button"
                          disabled={busy === n.id}
                          onClick={() => void setStatus(n.id, "open")}
                          className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground hover:text-foreground px-1.5"
                          title="Reopen"
                        >
                          Reopen
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={busy === n.id}
                        onClick={() => void remove(n.id)}
                        className="p-1.5 text-muted-foreground hover:text-destructive"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*                          Per-role chat panel                         */
/* ------------------------------------------------------------------ */

function StaffChat({
  role,
  issue,
  publicationId,
  selectedPageId,
  attachments,
  onPlaceAttachment,
}: {
  role: StaffRole;
  issue: IssueDoc;
  publicationId: string | null;
  selectedPageId: string;
  attachments?: AttachmentBrief[];
  onPlaceAttachment?: (id: string, patch: PlacementPatch) => Promise<void> | void;
}) {
  const issueId = issue.meta.issueId;
  const [initial, setInitial] = useState<UIMessage[] | null>(null);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const issueRef = useRef(issue);
  useEffect(() => {
    issueRef.current = issue;
  }, [issue]);
  const selectedPageIdRef = useRef(selectedPageId);
  useEffect(() => {
    selectedPageIdRef.current = selectedPageId;
  }, [selectedPageId]);

  useEffect(() => {
    let cancelled = false;
    setInitial(null);
    setThreadId(null);
    setLoadError(null);

    void (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) {
        if (!cancelled) {
          setLoadError("Not signed in");
          setInitial([]);
        }
        return;
      }

      let existingQ = supabase
        .from("staff_threads")
        .select("id")
        .eq("user_id", uid)
        .eq("issue_id", issueId)
        .eq("role", role.id);
      existingQ = publicationId === null
        ? existingQ.is("publication_id", null)
        : existingQ.eq("publication_id", publicationId);
      const { data: existing } = await existingQ.maybeSingle();

      let tid = existing?.id as string | undefined;
      if (!tid) {
        const { data: created, error: createErr } = await supabase
          .from("staff_threads")
          .insert({
            user_id: uid,
            issue_id: issueId,
            role: role.id,
            title: role.title,
            publication_id: publicationId,
          })
          .select("id")
          .single();
        if (createErr || !created) {
          if (!cancelled) {
            setLoadError(createErr?.message ?? "Could not open thread");
            setInitial([]);
          }
          return;
        }
        tid = created.id as string;
      }
      if (cancelled) return;
      setThreadId(tid);

      const { data: rows, error: msgsErr } = await supabase
        .from("staff_messages")
        .select("id, role, parts, created_at")
        .eq("thread_id", tid)
        .order("created_at", { ascending: true });
      if (cancelled) return;
      if (msgsErr) {
        setLoadError(msgsErr.message);
        setInitial([]);
        return;
      }
      const restored: UIMessage[] = (rows ?? []).map((row, i) => ({
        id: `${tid}-${i}`,
        role: row.role as UIMessage["role"],
        parts: (row.parts as UIMessage["parts"]) ?? [],
      }));
      setInitial(restored);
    })();

    return () => {
      cancelled = true;
    };
  }, [issueId, publicationId, role.id, role.title]);

  const attachmentsRef = useRef(attachments);
  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/staff-chat",
        headers: async () => {
          const { supabase } = await import("@/integrations/supabase/client");
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token;
          return token ? { Authorization: `Bearer ${token}` } : {};
        },
        prepareSendMessagesRequest: ({ messages, body }) => ({
          body: {
            ...body,
            role: role.id,
            issueId,
            messages,
            issueSnapshot: snapshotIssue(issueRef.current),
            selectedPageId: selectedPageIdRef.current,
            attachments: attachmentsRef.current ?? [],
          },
        }),
      }),
    [issueId, role.id],
  );

  const { messages, sendMessage, status, error } = useChat({
    id: `${issueId}:${role.id}`,
    messages: initial ?? [],
    transport,
  });

  // Persist new messages + file any tool-created notes + apply placements.
  const persistedRef = useRef<Set<string>>(new Set());
  const filedNotesRef = useRef<Set<string>>(new Set());
  const appliedPlacementsRef = useRef<Set<string>>(new Set());
  const onPlaceAttachmentRef = useRef(onPlaceAttachment);
  useEffect(() => {
    onPlaceAttachmentRef.current = onPlaceAttachment;
  }, [onPlaceAttachment]);

  useEffect(() => {
    if (!threadId) return;
    if (status !== "ready") return;
    void (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return;

      const toSaveMsgs: Array<{ id: string; role: string; parts: UIMessage["parts"] }> = [];
      const toFileNotes: Array<NoteToolOutput & { toolCallId: string }> = [];
      const toApplyPlacements: Array<PlacementToolOutput & { toolCallId: string }> = [];

      for (const m of messages) {
        if (!persistedRef.current.has(m.id) && !initial?.some((h) => h.id === m.id)) {
          persistedRef.current.add(m.id);
          toSaveMsgs.push({ id: m.id, role: m.role, parts: m.parts });
        }
        if (m.role !== "assistant") continue;
        for (const part of m.parts as Array<Record<string, unknown>>) {
          const partType = part.type;
          if (part.state !== "output-available") continue;
          const callId = String(part.toolCallId ?? "");
          if (!callId) continue;

          if (partType === "tool-create_note" && !filedNotesRef.current.has(callId)) {
            const output = part.output as NoteToolOutput | undefined;
            if (output && output.kind === "note") {
              filedNotesRef.current.add(callId);
              toFileNotes.push({ ...output, toolCallId: callId });
            }
          } else if (
            partType === "tool-place_attachment" &&
            !appliedPlacementsRef.current.has(callId)
          ) {
            const output = part.output as PlacementToolOutput | undefined;
            if (output && output.kind === "placement") {
              appliedPlacementsRef.current.add(callId);
              toApplyPlacements.push({ ...output, toolCallId: callId });
            }
          }
        }
      }

      if (toSaveMsgs.length) {
        const { error: insErr } = await supabase.from("staff_messages").insert(
          toSaveMsgs.map((m) => ({
            thread_id: threadId,
            user_id: uid,
            role: m.role,
            parts: m.parts as unknown as never,
            message_id: m.id,
          })),
        );
        if (insErr) console.warn("[staff-chat] persist failed:", insErr.message);
      }

      if (toFileNotes.length) {
        const { error: noteErr } = await supabase.from("staff_notes").insert(
          toFileNotes.map((n) => ({
            user_id: uid,
            issue_id: issueId,
            publication_id: publicationId,
            page_id: n.page_id ?? null,
            thread_id: threadId,
            role: role.id,
            type: n.type,
            title: n.title,
            body: n.body ?? null,
            payload: { severity: n.severity ?? null, toolCallId: n.toolCallId },
            status: "open",
          })),
        );
        if (noteErr) console.warn("[staff-chat] file note failed:", noteErr.message);
      }

      if (toApplyPlacements.length && onPlaceAttachmentRef.current) {
        for (const p of toApplyPlacements) {
          try {
            await onPlaceAttachmentRef.current(p.attachment_id, {
              page_id: p.page_id,
              region: p.region ?? null,
              position_x: p.position_x ?? null,
              position_y: p.position_y ?? null,
            });
          } catch (e) {
            console.warn("[staff-chat] place_attachment failed:", (e as Error).message);
          }
        }
      }
    })();
  }, [status, messages, initial, threadId, issueId, publicationId, role.id]);

  const [input, setInput] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);
  const isLoading = status === "submitted" || status === "streaming";

  useEffect(() => {
    if (status === "ready") taRef.current?.focus();
  }, [status]);
  useEffect(() => {
    taRef.current?.focus();
  }, [role.id]);

  const handleSubmit = (_msg: unknown, e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || isLoading) return;
    void sendMessage({ text });
    setInput("");
  };

  if (initial === null) {
    return (
      <div className="flex-1 grid place-items-center text-xs tracking-[0.25em] uppercase text-muted-foreground">
        Loading thread…
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <Conversation className="flex-1">
        <ConversationContent className="space-y-3 py-4">
          {messages.length === 0 && !isLoading && (
            <ConversationEmptyState
              title={`Brief ${role.name.split(" ")[0]}`}
              description={role.tagline}
            />
          )}
          {messages.map((m) => (
            <Message from={m.role} key={m.id}>
              <MessageContent>
                {m.parts.map((part, idx) => {
                  if (part.type === "text") {
                    return m.role === "assistant" ? (
                      <MessageResponse key={idx}>{part.text}</MessageResponse>
                    ) : (
                      <p key={idx} className="whitespace-pre-wrap">
                        {part.text}
                      </p>
                    );
                  }
                  if (
                    part.type === "tool-create_note" &&
                    (part as { state?: string }).state === "output-available"
                  ) {
                    const out = (part as { output?: NoteToolOutput }).output;
                    if (!out) return null;
                    const Icon = NOTE_ICONS[out.type] ?? MessageSquare;
                    return (
                      <div
                        key={idx}
                        className="mt-2 rounded-sm border border-border bg-secondary/40 px-3 py-2 text-xs flex items-start gap-2"
                      >
                        <Icon className="h-3.5 w-3.5 mt-0.5 text-muted-foreground" />
                        <div className="min-w-0">
                          <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
                            Filed to inbox · {NOTE_LABELS[out.type]}
                            {out.page_id ? ` · ${out.page_id}` : ""}
                          </div>
                          <div className="font-medium">{out.title}</div>
                        </div>
                      </div>
                    );
                  }
                  if (
                    part.type === "tool-place_attachment" &&
                    (part as { state?: string }).state === "output-available"
                  ) {
                    const out = (part as { output?: PlacementToolOutput }).output;
                    if (!out) return null;
                    const att = attachments?.find((a) => a.id === out.attachment_id);
                    const where =
                      out.region
                        ? `region ${out.region}`
                        : out.position_x != null && out.position_y != null
                          ? `pin ${Math.round(out.position_x * 100)}% / ${Math.round(out.position_y * 100)}%`
                          : "page";
                    return (
                      <div
                        key={idx}
                        className="mt-2 rounded-sm border border-border bg-secondary/40 px-3 py-2 text-xs flex items-start gap-2"
                      >
                        <MapPin className="h-3.5 w-3.5 mt-0.5 text-muted-foreground" />
                        <div className="min-w-0">
                          <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
                            Placed on page · {out.page_id} · {where}
                          </div>
                          <div className="font-medium truncate">
                            {att?.file_name ?? out.attachment_id}
                          </div>
                          {out.rationale && (
                            <div className="text-muted-foreground mt-0.5">{out.rationale}</div>
                          )}
                        </div>
                      </div>
                    );
                  }
                  return null;
                })}
              </MessageContent>
            </Message>
          ))}
          {status === "submitted" && (
            <Message from="assistant">
              <MessageContent>
                <Shimmer>Thinking…</Shimmer>
              </MessageContent>
            </Message>
          )}
          {error && <p className="text-xs text-destructive px-2">{error.message}</p>}
          {loadError && <p className="text-xs text-destructive px-2">{loadError}</p>}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="border-t border-border p-3">
        <PromptInput onSubmit={handleSubmit}>
          <PromptInputTextarea
            ref={taRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Message ${role.name.split(" ")[0]}…`}
          />
          <PromptInputFooter className="justify-end">
            <PromptInputSubmit status={status} disabled={!input.trim() || isLoading} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}

