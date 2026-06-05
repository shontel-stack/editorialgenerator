import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { STAFF_ROLES, type StaffRole } from "@/lib/staffRoles";
import { ChevronLeft, X, Users } from "lucide-react";

/* ------------------------------------------------------------------ */
/*                              Drawer shell                            */
/* ------------------------------------------------------------------ */

export function StaffPanel({
  open,
  onClose,
  issue,
  selectedPageId,
}: {
  open: boolean;
  onClose: () => void;
  issue: IssueDoc;
  selectedPageId: string;
}) {
  const [activeRoleId, setActiveRoleId] = useState<string | null>(null);
  const activeRole = activeRoleId ? STAFF_ROLES.find((r) => r.id === activeRoleId) ?? null : null;

  // Reset to roster when the panel closes.
  useEffect(() => {
    if (!open) setActiveRoleId(null);
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
              <Users className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground">
                  Editorial &amp; Marketing
                </div>
                <div className="text-sm font-medium">Masthead</div>
              </div>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground"
          title="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      {activeRole ? (
        <StaffChat
          key={`${issue.meta.issueId}:${activeRole.id}`}
          role={activeRole}
          issue={issue}
          selectedPageId={selectedPageId}
        />
      ) : (
        <StaffRoster
          issueId={issue.meta.issueId}
          onPick={(id) => setActiveRoleId(id)}
        />
      )}
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/*                              Roster grid                             */
/* ------------------------------------------------------------------ */

function StaffRoster({
  issueId,
  onPick,
}: {
  issueId: string;
  onPick: (roleId: string) => void;
}) {
  const [counts, setCounts] = useState<Record<string, number>>({});

  // Load per-role message counts for this issue (lightweight, no realtime).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return;
      const { data, error } = await supabase
        .from("staff_threads")
        .select("role, id")
        .eq("issue_id", issueId)
        .eq("user_id", uid);
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
  }, [issueId]);

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
/*                          Per-role chat panel                         */
/* ------------------------------------------------------------------ */

function StaffChat({
  role,
  issue,
  selectedPageId,
}: {
  role: StaffRole;
  issue: IssueDoc;
  selectedPageId: string;
}) {
  const issueId = issue.meta.issueId;
  const [initial, setInitial] = useState<UIMessage[] | null>(null);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Latest snapshot lives in a ref so transport doesn't rebuild every render.
  const issueRef = useRef(issue);
  useEffect(() => {
    issueRef.current = issue;
  }, [issue]);
  const selectedPageIdRef = useRef(selectedPageId);
  useEffect(() => {
    selectedPageIdRef.current = selectedPageId;
  }, [selectedPageId]);

  // Ensure a thread exists and load its history.
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

      // Upsert the (user, issue, role) thread.
      const { data: existing } = await supabase
        .from("staff_threads")
        .select("id")
        .eq("user_id", uid)
        .eq("issue_id", issueId)
        .eq("role", role.id)
        .maybeSingle();

      let tid = existing?.id as string | undefined;
      if (!tid) {
        const { data: created, error: createErr } = await supabase
          .from("staff_threads")
          .insert({ user_id: uid, issue_id: issueId, role: role.id, title: role.title })
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
  }, [issueId, role.id, role.title]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/staff-chat",
        prepareSendMessagesRequest: ({ messages, body }) => ({
          body: {
            ...body,
            role: role.id,
            issueId,
            messages,
            issueSnapshot: snapshotIssue(issueRef.current),
            selectedPageId: selectedPageIdRef.current,
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

  // Persist new messages (skip restored history).
  const persistedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!threadId) return;
    if (status !== "ready") return;
    const toSave: Array<{ id: string; role: string; parts: UIMessage["parts"] }> = [];
    for (const m of messages) {
      if (persistedRef.current.has(m.id)) continue;
      persistedRef.current.add(m.id);
      if (initial?.some((h) => h.id === m.id)) continue;
      toSave.push({ id: m.id, role: m.role, parts: m.parts });
    }
    if (!toSave.length) return;
    void (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return;
      const { error: insErr } = await supabase.from("staff_messages").insert(
        toSave.map((m) => ({
          thread_id: threadId,
          user_id: uid,
          role: m.role,
          parts: m.parts as unknown as never,
          message_id: m.id,
        })),
      );
      if (insErr) console.warn("[staff-chat] persist failed:", insErr.message);
    })();
  }, [status, messages, initial, threadId]);

  const [input, setInput] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);
  const isLoading = status === "submitted" || status === "streaming";

  // Keep textarea focused on mount, after send, and after stream completion.
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
          {error && (
            <p className="text-xs text-destructive px-2">{error.message}</p>
          )}
          {loadError && (
            <p className="text-xs text-destructive px-2">{loadError}</p>
          )}
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
            <PromptInputSubmit
              status={status}
              disabled={!input.trim() || isLoading}
            />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}
