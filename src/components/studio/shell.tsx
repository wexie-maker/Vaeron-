import { Link } from "@tanstack/react-router";
import { BoardView } from "@/components/studio/board-view";
import { CastView } from "@/components/studio/cast-view";
import { CutView } from "@/components/studio/cut-view";
import { DeskView, PagesView, PromptView, SoundView, VaultView } from "@/components/studio/extras";
import { Mark } from "@/components/studio/mark";
import { StoryView } from "@/components/studio/story-view";
import { Notice } from "@/components/studio/ui";
import { formatClock, formatMoney, runtimeStats } from "@/lib/studio/plan";
import { useStudio } from "@/lib/studio/store";
import { SECTIONS, type Project, type Section } from "@/lib/studio/types";

export function StudioShell({ projectId }: { projectId: string }) {
  const ready = useStudio((state) => state.ready);
  const project = useStudio((state) => state.projects.find((item) => item.id === projectId));
  const section = useStudio((state) => state.section);
  const setSection = useStudio((state) => state.setSection);
  const notice = useStudio((state) => state.notice);
  const setNotice = useStudio((state) => state.setNotice);
  const aiAvailable = useStudio((state) => state.aiAvailable);

  if (!ready) {
    return (
      <main className="grid min-h-screen place-items-center px-6 text-sm text-muted">
        Opening the vault…
      </main>
    );
  }

  if (!project) {
    return (
      <main className="grid min-h-screen place-items-center px-6 text-center">
        <div>
          <h1 className="font-display text-4xl">That picture is not in the vault.</h1>
          <Link to="/" className="focus-ring mt-4 inline-flex min-h-11 items-center text-sm text-crimson">
            Back to Vaeron
          </Link>
        </div>
      </main>
    );
  }

  const stats = runtimeStats(project);

  return (
    <div className="min-h-screen">
      <div className="film-rule" />
      <header className="flex flex-wrap items-center justify-between gap-3 px-[var(--space-page)] py-4">
        <div className="flex items-center gap-3">
          <Link to="/" className="focus-ring rounded-sm text-fg" aria-label="Vaeron home">
            <Mark className="size-8" />
          </Link>
          <div>
            <p className="font-display text-2xl leading-none">{project.title}</p>
            <p className="text-xs text-faint">
              {aiAvailable === false ? "AI unavailable · local tools still work" : "Saved on this device"}
            </p>
          </div>
        </div>
        <p className="font-mono text-xs text-muted tabular-nums">
          {formatClock(stats.filmed)} filmed · {formatClock(stats.target)} target · floor {formatMoney(stats.fullTargetFloor)}
        </p>
      </header>
      <Notice text={notice} onClose={() => setNotice(null)} />
      <div className="lg:grid lg:grid-cols-[11rem_1fr]">
        <nav className="flex gap-1 overflow-x-auto border-b border-line px-3 py-2 lg:flex-col lg:border-r lg:border-b-0 lg:px-3 lg:py-4">
          {SECTIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSection(item.id)}
              className={`focus-ring min-h-11 shrink-0 rounded-sm px-3 text-left text-sm ${section === item.id ? "bg-subtle text-fg" : "text-muted"}`}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <main className="min-w-0 px-[var(--space-page)] py-5 pb-16">
          <SectionBody section={section} project={project} />
        </main>
      </div>
    </div>
  );
}

function SectionBody({ section, project }: { section: Section; project: Project }) {
  if (section === "story") return <StoryView project={project} />;
  if (section === "cast") return <CastView project={project} />;
  if (section === "board") return <BoardView project={project} />;
  if (section === "cut") return <CutView project={project} />;
  if (section === "sound") return <SoundView project={project} />;
  if (section === "prompts") return <PromptView project={project} />;
  if (section === "pages") return <PagesView project={project} />;
  if (section === "desk") return <DeskView project={project} />;
  return <VaultView project={project} />;
}
