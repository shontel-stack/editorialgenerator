import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useRef, useState } from "react";
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
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";
import { supabase } from "@/integrations/supabase/client";
import { snapshotIssue } from "@/lib/issue-snapshot";
import { applyPatch, describePatch, type IssuePatch } from "@/lib/issue-patch";
import type { IssueDoc } from "@/lib/coverDefaults";
import type { AttachmentWithUrl } from "@/lib/attachments";
import { isImage, isPdf, isWordDoc } from "@/lib/attachments";
import { Paperclip } from "lucide-react";

type ToolPart = Extract<UIMessage["parts"][number], { type: `tool-${string}` }>;

function isToolPart(part: UIMessage["parts"][number]): part is ToolPart {
  return typeof part.type === "string" && part.type.startsWith("tool-");
}

export type PendingSpatialProposal = {
  toolCallId: string;
  pageId: string;
  blockKey: string;
  kind: "move_block" | "scale_block";
  dx?: number;
  dy?: number;
  scale?: number;
  reset?: boolean;
};

export function AssistantPanel({
  open,
  onClose,
  issue,
  setIssue,
  attachments,
  selectedPageId,
  onSelectPage,
  pendingSpatial,
  onProposeSpatial,
  onResolvePending,
}: {
  open: boolean;
  onClose: () => void;
  issue: IssueDoc;
  setIssue: (next: IssueDoc | ((prev: IssueDoc) => IssueDoc)) => void;
  attachments: AttachmentWithUrl[];
  selectedPageId: string;
  onSelectPage?: (pageId: string) => void;
  pendingSpatial: PendingSpatialProposal[];
  onProposeSpatial: (proposal: PendingSpatialProposal) => void;
  onResolvePending: (toolCallId: string, action: "apply" | "cancel") => void;
}) {
  const issueId = issue.meta.issueId;
  const [initial, setInitial] = useState<UIMessage[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Snapshot + attachments stay in refs so the transport reads the latest
  // values without recreating the chat instance on every render.
  const issueRef = useRef(issue);
  useEffect(() => { issueRef.current = issue; }, [issue]);
  const attachmentsRef = useRef(attachments);
  useEffect(() => { attachmentsRef.current = attachments; }, [attachments]);
  const selectedPageIdRef = useRef(selectedPageId);
  useEffect(() => { selectedPageIdRef.current = selectedPageId; }, [selectedPageId]);

  // Load history for this issue.
  useEffect(() => {
    let cancelled = false;
    setInitial(null);
    setLoadError(null);
    void supabase
      .from("issue_chats")
      .select("role, parts, created_at")
      .eq("issue_id", issueId)
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) { setLoadError(error.message); setInitial([]); return; }
        const restored: UIMessage[] = (data ?? []).map((row, i) => ({
          id: `${issueId}-${i}`,
          role: row.role as UIMessage["role"],
          parts: (row.parts as UIMessage["parts"]) ?? [],
        }));
        setInitial(restored);
      });
    return () => { cancelled = true; };
  }, [issueId]);

  const { messages, sendMessage, status, error } = useChat({
    id: issueId,
    messages: initial ?? [],
    transport: new DefaultChatTransport({
      api: "/api/chat",
      headers: async () => {
        const { supabase } = await import("@/integrations/supabase/client");
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        return token ? { Authorization: `Bearer ${token}` } : {};
      },
      prepareSendMessagesRequest: ({ messages, body }) => ({
        body: {
          ...body,
          messages,
          issueSnapshot: snapshotIssue(issueRef.current),
          selectedPageId: selectedPageIdRef.current,
          attachments: attachmentsRef.current.map((a) => ({
            kind: a.kind,
            page_id: a.page_id,
            file_name: a.file_name,
            mime_type: a.mime_type,
            signed_url: a.signedUrl,
            extracted_text: a.extracted_text,
          })),
        },
      }),
    }),
  });

  // Apply tool-output patches to the issue exactly once per tool call.
  // For move_block / scale_block, we PROPOSE a pending preview instead of applying directly.
  const appliedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    for (const m of messages) {
      if (m.role !== "assistant") continue;
      for (const part of m.parts) {
        if (!isToolPart(part)) continue;
        const tc = part as ToolPart & { toolCallId?: string; state?: string; output?: unknown };
        const key = tc.toolCallId ?? `${m.id}:${part.type}`;
        if (appliedRef.current.has(key)) continue;
        if (tc.state !== "output-available" || !tc.output) continue;
        const patch = tc.output as IssuePatch;
        if (!patch?.kind) continue;
        appliedRef.current.add(key);
        if (patch.kind === "move_block" || patch.kind === "scale_block") {
          onProposeSpatial({
            toolCallId: key,
            pageId: patch.pageId,
            blockKey: patch.blockKey,
            kind: patch.kind,
            dx: patch.kind === "move_block" ? patch.dx : undefined,
            dy: patch.kind === "move_block" ? patch.dy : undefined,
            scale: patch.kind === "scale_block" ? patch.scale : undefined,
            reset: patch.reset,
          });
          onSelectPage?.(patch.pageId);
        } else {
          setIssue((prev) => applyPatch(prev, patch));
        }
      }
    }
  }, [messages, setIssue, onProposeSpatial, onSelectPage]);

  // Persist each completed assistant turn + the user message that triggered it.
  const persistedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (status !== "ready") return;
    const toSave: Array<{ id: string; role: string; parts: UIMessage["parts"] }> = [];
    for (const m of messages) {
      if (persistedRef.current.has(m.id)) continue;
      persistedRef.current.add(m.id);
      // Skip restored history (loaded from the DB).
      if (initial?.some((h) => h.id === m.id)) continue;
      toSave.push({ id: m.id, role: m.role, parts: m.parts });
    }
    if (!toSave.length) return;
    void (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return;
      const { error } = await supabase.from("issue_chats").insert(
        toSave.map((m) => ({
          issue_id: issueId,
          user_id: uid,
          role: m.role,
          parts: m.parts as unknown as never,
        })),
      );
      if (error) console.warn("[chat] persist failed:", error.message);
    })();
  }, [status, messages, initial, issueId]);

  const [input, setInput] = useState("");
  const isLoading = status === "submitted" || status === "streaming";

  const handleSubmit = (
    _message: unknown,
    e: React.FormEvent<HTMLFormElement>,
  ) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || isLoading) return;
    setInput("");
    void sendMessage({ text });
  };

  if (!open) return null;

  return (
    <aside
      className="fixed inset-y-0 right-0 z-50 w-full sm:w-[420px] bg-background border-l border-border shadow-2xl flex flex-col"
      style={{ fontFamily: "var(--font-sans)" }}
    >
      <header className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div>
          <div className="text-[10px] tracking-[0.4em] uppercase text-muted-foreground">
            Editorial assistant
          </div>
          <div className="text-sm" style={{ fontFamily: "var(--font-serif)" }}>
            Issue · {issue.meta.issue}
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-xs px-2 py-1 border border-border hover:bg-secondary uppercase tracking-[0.2em]"
        >
          Close
        </button>
      </header>

      <ReferencesStrip attachments={attachments} selectedPageId={selectedPageId} />



      <Conversation className="flex-1">
        <ConversationContent>
          {initial === null ? (
            <div className="p-6 text-sm text-muted-foreground"><Shimmer>Loading chat…</Shimmer></div>
          ) : loadError ? (
            <div className="p-6 text-sm text-destructive">Could not load chat: {loadError}</div>
          ) : messages.length === 0 ? (
            <ConversationEmptyState
              title="Bring your layout brief"
              description="Paste article information, ask for headline options, request layout changes, or critique a spread. I can edit pages directly."
            />
          ) : (
            messages.map((m) => (
              <Message key={m.id} from={m.role}>
                <MessageContent>
                  {m.parts.map((part, i) => {
                    if (part.type === "text") {
                      return m.role === "assistant" ? (
                        <MessageResponse key={i}>{part.text}</MessageResponse>
                      ) : (
                        <p key={i} className="whitespace-pre-wrap">{part.text}</p>
                      );
                    }
                    if (isToolPart(part)) {
                      const tc = part as ToolPart & {
                        toolCallId?: string;
                        state?: string;
                        input?: unknown;
                        output?: unknown;
                        errorText?: string;
                      };
                      const name = (part.type as string).replace(/^tool-/, "");
                      const patch = tc.output as IssuePatch | undefined;
                      const tcId = tc.toolCallId ?? `${m.id}:${part.type}`;
                      const isSpatial = patch?.kind === "move_block" || patch?.kind === "scale_block";
                      const stillPending = isSpatial && pendingSpatial.some((p) => p.toolCallId === tcId);
                      return (
                        <Tool key={tc.toolCallId ?? i} defaultOpen={isSpatial}>
                          <ToolHeader
                            type={`tool-${name}` as `tool-${string}`}
                            state={(tc.state ?? "input-available") as never}
                          />
                          <ToolContent>
                            <ToolInput input={tc.input} />
                            <ToolOutput
                              output={
                                patch?.kind ? (
                                  <div className="text-xs space-y-2">
                                    <div>
                                      <span className="text-muted-foreground">
                                        {isSpatial ? (stillPending ? "Proposed: " : "Resolved: ") : "Applied: "}
                                      </span>
                                      {describePatch(patch)}
                                    </div>
                                    {isSpatial && stillPending && (
                                      <div className="flex items-center gap-2 pt-1">
                                        <button
                                          type="button"
                                          onClick={() => onResolvePending(tcId, "apply")}
                                          className="px-3 py-1 text-[11px] tracking-[0.2em] uppercase bg-foreground text-background hover:opacity-90"
                                        >
                                          Apply
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => onResolvePending(tcId, "cancel")}
                                          className="px-3 py-1 text-[11px] tracking-[0.2em] uppercase border border-border hover:bg-secondary"
                                        >
                                          Cancel
                                        </button>
                                        <span className="text-[10px] text-muted-foreground">Preview highlighted on the page</span>
                                      </div>
                                    )}
                                  </div>
                                ) : tc.output ? (
                                  <pre className="text-xs">{JSON.stringify(tc.output, null, 2)}</pre>
                                ) : null
                              }
                              errorText={tc.errorText}
                            />
                          </ToolContent>
                        </Tool>
                      );
                    }
                    return null;
                  })}
                </MessageContent>
              </Message>
            ))
          )}
          {status === "submitted" && (
            <div className="px-4 py-2 text-sm text-muted-foreground">
              <Shimmer>Thinking…</Shimmer>
            </div>
          )}
          {error && (
            <div className="px-4 py-2 text-sm text-destructive">
              {error.message || "Something went wrong."}
            </div>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="p-3 border-t border-border">
        <PromptInput onSubmit={handleSubmit}>
          <PromptInputTextarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Paste a brief, ask for headlines, request a layout…"
            autoFocus
          />
          <PromptInputFooter className="justify-end">
            <PromptInputSubmit status={status} disabled={isLoading || !input.trim()} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </aside>
  );
}

function ReferencesStrip({
  attachments,
  selectedPageId,
}: {
  attachments: AttachmentWithUrl[];
  selectedPageId: string;
}) {
  const template = attachments.find((a) => a.kind === "template");
  const selectedRef = attachments.find(
    (a) => a.kind === "reference" && a.page_id === selectedPageId,
  );
  if (!template && !selectedRef) return null;

  const Chip = ({ a, label }: { a: AttachmentWithUrl; label: string }) => {
    const kind = isPdf(a.mime_type) ? "PDF" : isImage(a.mime_type) ? "Image" : isWordDoc(a.mime_type) ? "Word" : "File";
    return (
      <div className="flex items-center gap-1.5 border border-[color:var(--ruby)]/40 bg-[color:var(--ruby)]/5 px-2 py-1 rounded-sm max-w-full">
        <Paperclip className="h-3 w-3 text-[color:var(--ruby)] shrink-0" />
        <div className="min-w-0">
          <div className="text-[8px] tracking-[0.3em] uppercase text-muted-foreground">{label} · {kind}</div>
          <div className="text-[11px] truncate" title={a.file_name}>{a.file_name}</div>
        </div>
      </div>
    );
  };

  return (
    <div className="px-4 py-2 border-b border-border bg-secondary/40 flex flex-wrap gap-2">
      {template && <Chip a={template} label="Issue template" />}
      {selectedRef && <Chip a={selectedRef} label="This page" />}
    </div>
  );
}

