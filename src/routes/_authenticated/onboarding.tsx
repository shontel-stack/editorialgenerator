/**
 * First-run onboarding wizard. Reached automatically from `/` when the
 * signed-in user has zero publications; the editor's `beforeLoad` guard
 * redirects here. Three warm, editorial steps land the reader in the
 * editor with a publication (and a starter template choice) in hand.
 */

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { BookOpen, Feather, ArrowRight, Check, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useActivePublication } from "@/hooks/useActivePublication";
import { MagazineTemplatePicker } from "@/components/MagazineTemplatePicker";
import { makeDefaultIssue, type IssueDoc } from "@/lib/coverDefaults";
import type { MagazineLayoutStyle } from "@/lib/magazineLayoutStyles";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Welcome — set up your first publication · Pageluxe" },
      {
        name: "description",
        content:
          "Name a masthead, sketch a debut issue, and pick a template — three quiet steps and you're at the drawing board.",
      },
    ],
  }),
  component: OnboardingPage,
});

type StepKey = 1 | 2 | 3;

function OnboardingPage() {
  const navigate = useNavigate();
  const { userId, publications, active, loading, create, select } = useActivePublication();

  const [step, setStep] = useState<StepKey>(1);
  const [pubName, setPubName] = useState("");
  const [pubTagline, setPubTagline] = useState("");
  const [pubBusy, setPubBusy] = useState(false);
  const [issueName, setIssueName] = useState("Debut Issue");
  const [scratchIssue, setScratchIssue] = useState<IssueDoc>(() => makeDefaultIssue());
  const [chosenLayout, setChosenLayout] = useState<MagazineLayoutStyle | null>(null);

  // If the user arrives here but already has a publication (they navigated
  // manually, or completed step 1), mark it done and skip ahead.
  useEffect(() => {
    if (loading) return;
    if (publications.length > 0 && step === 1) {
      const p = active ?? publications[0];
      setPubName((n) => n || p.name);
      setStep(2);
    }
  }, [loading, publications, active, step]);

  const currentPubName = active?.name ?? publications[0]?.name ?? pubName;

  const submitPublication = async (e: FormEvent) => {
    e.preventDefault();
    const name = pubName.trim();
    if (!name) {
      toast.error("Give your publication a name to continue.");
      return;
    }
    if (!userId) {
      toast.error("Not signed in yet — one moment.");
      return;
    }
    setPubBusy(true);
    try {
      const pub = await create({
        name,
        tagline: pubTagline.trim() || undefined,
      });
      if (!pub) throw new Error("Could not create publication.");
      toast.success(`Masthead “${pub.name}” set.`);
      setStep(2);
    } catch (err) {
      toast.error(`Couldn't save: ${(err as Error).message}`);
    } finally {
      setPubBusy(false);
    }
  };

  const submitIssueName = (e: FormEvent) => {
    e.preventDefault();
    const name = issueName.trim();
    if (!name) {
      toast.error("Give your first issue a working title.");
      return;
    }
    try {
      window.localStorage.setItem("pageluxe:onboarding:issueName", name);
    } catch {
      // ignore quota / privacy-mode failures
    }
    setStep(3);
  };

  const openEditor = async () => {
    if (chosenLayout) {
      try {
        window.localStorage.setItem(
          "pageluxe:onboarding:layoutStyle",
          JSON.stringify(chosenLayout),
        );
      } catch {
        // ignore
      }
    }
    // Make sure the newly-created publication is the active one so the
    // editor opens against it.
    if (active?.id) await select(active.id);
    navigate({ to: "/" });
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-6 py-12 md:py-20">
        <Hero />
        <div className="mt-10 space-y-6">
          <Step
            n={1}
            active={step === 1}
            done={step > 1}
            title="Name your publication"
            hint="The masthead everything else hangs from — a magazine title, a newsletter name, a zine imprint."
          >
            {step === 1 ? (
              <form onSubmit={submitPublication} className="space-y-3">
                <div>
                  <label className="block text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-1">
                    Publication name
                  </label>
                  <input
                    autoFocus
                    value={pubName}
                    onChange={(e) => setPubName(e.target.value)}
                    placeholder="e.g. Foundry Quarterly"
                    className="w-full border border-input bg-background px-3 py-2.5 text-base rounded-sm focus:outline-none focus:ring-1 focus:ring-ring focus:border-ring"
                  />
                </div>
                <div>
                  <label className="block text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-1">
                    Tagline · optional
                  </label>
                  <input
                    value={pubTagline}
                    onChange={(e) => setPubTagline(e.target.value)}
                    placeholder="A quiet line of intent"
                    className="w-full border border-input bg-background px-3 py-2 text-sm rounded-sm focus:outline-none focus:ring-1 focus:ring-ring focus:border-ring"
                  />
                </div>
                <div className="pt-2 flex items-center justify-between gap-3">
                  <p className="text-[11px] text-muted-foreground">
                    You can rename or add more publications any time from the workspace switcher.
                  </p>
                  <button
                    type="submit"
                    disabled={pubBusy || !pubName.trim()}
                    className="inline-flex items-center gap-2 bg-[color:var(--ruby)] text-[color:var(--accent-foreground)] px-4 py-2.5 text-[10px] tracking-[0.3em] uppercase rounded-sm hover:bg-[color:var(--ruby-deep)] transition disabled:opacity-60"
                  >
                    {pubBusy ? "Setting…" : "Set masthead"}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </form>
            ) : (
              <StepSummary
                icon={<BookOpen className="h-3.5 w-3.5" />}
                label="Masthead"
                value={currentPubName || "Untitled publication"}
              />
            )}
          </Step>

          <Step
            n={2}
            active={step === 2}
            done={step > 2}
            title="Start your first issue"
            hint="A working title is enough — you'll refine cover, date, and contents inside the editor."
          >
            {step === 2 ? (
              <form onSubmit={submitIssueName} className="space-y-3">
                <div>
                  <label className="block text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-1">
                    Issue title
                  </label>
                  <input
                    autoFocus
                    value={issueName}
                    onChange={(e) => setIssueName(e.target.value)}
                    placeholder="e.g. Debut · Winter 2026"
                    className="w-full border border-input bg-background px-3 py-2.5 text-base rounded-sm focus:outline-none focus:ring-1 focus:ring-ring focus:border-ring"
                  />
                </div>
                <div className="pt-2 flex items-center justify-between gap-3">
                  <p className="text-[11px] text-muted-foreground">
                    We'll seed the editor with this title on the cover page.
                  </p>
                  <button
                    type="submit"
                    disabled={!issueName.trim()}
                    className="inline-flex items-center gap-2 bg-[color:var(--ruby)] text-[color:var(--accent-foreground)] px-4 py-2.5 text-[10px] tracking-[0.3em] uppercase rounded-sm hover:bg-[color:var(--ruby-deep)] transition disabled:opacity-60"
                  >
                    Continue
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </form>
            ) : step > 2 ? (
              <StepSummary
                icon={<Feather className="h-3.5 w-3.5" />}
                label="First issue"
                value={issueName || "Untitled issue"}
              />
            ) : null}
          </Step>

          <Step
            n={3}
            active={step === 3}
            done={false}
            title="Pick a masthead template"
            hint="Choose a layout to start from — margins, columns, and rhythm. You can change it any time inside the editor."
          >
            {step === 3 ? (
              <div className="space-y-4">
                <div className="rounded-sm border border-border bg-card p-4">
                  <MagazineTemplatePicker
                    userId={userId}
                    publicationId={active?.id ?? null}
                    issue={scratchIssue}
                    onApply={(next) => {
                      setScratchIssue(next);
                      const style = next.meta?.layoutStyle ?? null;
                      setChosenLayout(style);
                    }}
                  />
                </div>
                {chosenLayout ? (
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <Check className="h-3.5 w-3.5 text-[color:var(--ruby)]" />
                    Template picked · {chosenLayout.label}
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    Tap a preset above (or skip — the editor's default works beautifully too).
                  </p>
                )}
                <div className="flex items-center justify-between gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => void openEditor()}
                    className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-4"
                  >
                    Skip template — take me to the editor
                  </button>
                  <button
                    type="button"
                    onClick={() => void openEditor()}
                    className="inline-flex items-center gap-2 bg-foreground text-background px-4 py-2.5 text-[10px] tracking-[0.3em] uppercase rounded-sm hover:bg-[color:var(--ruby)] transition"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Open the editor
                  </button>
                </div>
              </div>
            ) : null}
          </Step>
        </div>
      </div>
    </main>
  );
}

function Hero() {
  return (
    <div className="text-center space-y-3">
      <div className="inline-flex items-center gap-2 text-[10px] tracking-[0.4em] uppercase text-muted-foreground">
        <span className="h-px w-8 bg-[color:var(--ruby)]" />
        Welcome to Pageluxe
        <span className="h-px w-8 bg-[color:var(--ruby)]" />
      </div>
      <h1
        className="font-display text-3xl md:text-5xl tracking-tight text-foreground"
        style={{ fontFamily: "var(--font-display)" }}
      >
        Your first issue, three quiet steps.
      </h1>
      <p className="max-w-xl mx-auto text-sm md:text-base leading-relaxed text-muted-foreground">
        Every publication begins with a masthead, an issue in mind, and a page of
        typographic bones. Set those here — you'll be at the drawing board in a
        minute.
      </p>
    </div>
  );
}

function Step({
  n,
  active,
  done,
  title,
  hint,
  children,
}: {
  n: 1 | 2 | 3;
  active: boolean;
  done: boolean;
  title: string;
  hint: string;
  children?: ReactNode;
}) {
  const numeral = useMemo(() => ["I", "II", "III"][n - 1], [n]);
  return (
    <section
      aria-current={active ? "step" : undefined}
      className={
        "border rounded-sm bg-card transition " +
        (active
          ? "border-[color:var(--ruby)]/50 shadow-[0_1px_0_rgba(0,0,0,0.03)]"
          : done
            ? "border-border"
            : "border-border/60 opacity-70")
      }
    >
      <div className="flex items-start gap-4 p-5 md:p-6">
        <div
          className={
            "shrink-0 grid place-items-center rounded-full border h-11 w-11 font-brand text-lg " +
            (done
              ? "bg-[color:var(--ruby)]/10 border-[color:var(--ruby)]/40 text-[color:var(--ruby-deep)]"
              : active
                ? "bg-foreground text-background border-foreground"
                : "bg-background text-muted-foreground border-border")
          }
          style={{ fontFamily: "var(--font-brand)" }}
          aria-hidden
        >
          {done ? <Check className="h-4 w-4" /> : numeral}
        </div>
        <div className="flex-1 min-w-0">
          <h2
            className="font-display text-lg md:text-xl tracking-tight text-foreground"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {title}
          </h2>
          <p className="mt-1 text-[12px] md:text-[13px] leading-relaxed text-muted-foreground">
            {hint}
          </p>
          {children ? <div className="mt-4">{children}</div> : null}
        </div>
      </div>
    </section>
  );
}

function StepSummary({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="inline-flex items-center gap-2 rounded-sm border border-border bg-secondary/50 px-3 py-1.5 text-[11px] text-muted-foreground">
      <span className="text-[color:var(--ruby)]">{icon}</span>
      <span className="tracking-[0.2em] uppercase text-[10px]">{label}</span>
      <span className="text-foreground font-medium">· {value}</span>
    </div>
  );
}

// keep import used for the type only

