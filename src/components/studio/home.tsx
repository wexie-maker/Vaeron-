import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ClapperStripes, Mark } from "@/components/studio/mark";
import { Button, Field, fieldClass } from "@/components/studio/ui";
import { formatClock, formatMoney, runtimeStats } from "@/lib/studio/plan";
import { blankFrom, useStudio } from "@/lib/studio/store";
import type { Aspect, Project } from "@/lib/studio/types";

const ASPECTS: Aspect[] = ["21:9", "16:9", "9:16", "1:1"];

export function Home() {
  const ready = useStudio((state) => state.ready);
  const projects = useStudio((state) => state.projects);
  const createProject = useStudio((state) => state.createProject);
  const ensureSample = useStudio((state) => state.ensureSample);
  const deleteProject = useStudio((state) => state.deleteProject);
  const importProject = useStudio((state) => state.importProject);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [minutes, setMinutes] = useState(70);
  const [aspect, setAspect] = useState<Aspect>("21:9");
  const [language, setLanguage] = useState("English");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  function start() {
    const project = blankFrom({ title, targetMinutes: minutes, aspect, language });
    createProject(project);
    void navigate({ to: "/studio/$projectId", params: { projectId: project.id } });
  }

  return (
    <div className="min-h-screen">
      <div className="film-rule" />
      <header className="flex items-center justify-between gap-4 px-[var(--space-page)] py-5">
        <div className="flex items-center gap-3">
          <Mark className="size-8 text-fg" />
          <div>
            <p className="font-display text-2xl leading-none font-medium">Vaeron</p>
            <p className="text-xs tracking-[0.16em] text-muted uppercase">Private AI movie studio</p>
          </div>
        </div>
        <p className="hidden text-xs text-faint sm:block">Stays in this browser</p>
      </header>

      <main className="mx-auto grid max-w-6xl gap-10 px-[var(--space-page)] pt-6 pb-16 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="rise">
          <p className="text-xs font-medium tracking-[0.18em] text-crimson uppercase">At least 70 minutes</p>
          <h1 className="mt-3 max-w-xl font-display text-5xl leading-[0.95] font-medium md:text-7xl">
            Seventy minutes, cut from short clips.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted">
            Write the picture, keep the cast, board the shots, and assemble a movie of at least 70 minutes, up to two hours.
            Each AI clip is 15 seconds or less. Nothing that spends credits runs unless you approve that clip.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button variant="solid" onClick={() => setOpen((value) => !value)}>
              {open ? "Close form" : "New picture"}
            </Button>
            <Button variant="quiet" onClick={ensureSample}>
              Restore sample
            </Button>
          </div>
          {open && (
            <form
              className="mt-6 grid gap-4 rounded-lg border border-line bg-elevated p-4 md:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault();
                start();
              }}
            >
              <Field label="Title">
                <input className={fieldClass} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Working title" />
              </Field>
              <Field label="Language">
                <input className={fieldClass} value={language} onChange={(event) => setLanguage(event.target.value)} />
              </Field>
              <Field label={`Target length · ${minutes} min`}>
                <input
                  className="w-full accent-crimson"
                  type="range"
                  min={70}
                  max={120}
                  step={5}
                  value={minutes}
                  onChange={(event) => setMinutes(Number(event.target.value))}
                />
              </Field>
              <Field label="Frame">
                <select className={fieldClass} value={aspect} onChange={(event) => setAspect(event.target.value as Aspect)}>
                  {ASPECTS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="md:col-span-2">
                <Button variant="solid" type="submit">
                  Open the studio
                </Button>
                <p className="mt-3 text-sm text-muted">
                  Filming the full {minutes} minutes on the cheap model, at the published floor of $0.02 a second and 480p, starts near{" "}
                  <span className="text-fg tabular-nums">{formatMoney(minutes * 60 * 0.02)}</span>. That is an estimate, not a quote. Vaeron will not start it for you.
                </p>
              </div>
            </form>
          )}
        </div>

        <aside className="rise overflow-hidden rounded-lg border border-line bg-elevated">
          <ClapperStripes />
          <div className="p-5">
            <p className="text-xs tracking-[0.16em] text-muted uppercase">Call sheet</p>
            <dl className="mt-4 space-y-3 text-sm">
              <Row k="Picture length" v="1:10:00 to 2:00:00" />
              <Row k="Clip limit" v="15 seconds" />
              <Row k="Where it lives" v="This browser" />
              <Row k="Paid renders" v="One approval each" />
              <Row k="70 min floor, lite 480p" v={formatMoney(84)} />
            </dl>
            <p className="mt-4 text-xs leading-relaxed text-faint">
              Unlimited high-quality generation is not free and is not guaranteed. Local tools — pages, board, cut, subtitles, backups — do not call out.
            </p>
          </div>
        </aside>

        <section className="lg:col-span-2">
          <div className="mb-4 flex items-end justify-between gap-3">
            <h2 className="font-display text-3xl font-medium">Vault</h2>
            <label className="focus-ring inline-flex min-h-11 cursor-pointer items-center rounded-sm border border-line px-4 text-sm text-muted">
              Import backup
              <input
                className="sr-only"
                type="file"
                accept="application/json"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  void file.text().then((raw) => {
                    const parsed = JSON.parse(raw) as Project;
                    if (!parsed.title || !parsed.sequences) throw new Error("Not a Vaeron backup");
                    importProject(parsed);
                  }).catch(() => {
                    useStudio.getState().setNotice("That file is not a Vaeron backup.");
                  });
                  event.target.value = "";
                }}
              />
            </label>
          </div>
          {!ready && <p className="text-sm text-muted">Opening the vault…</p>}
          {ready && projects.length === 0 && (
            <p className="rounded-lg border border-line bg-elevated p-5 text-sm text-muted">
              No pictures yet. Start one, or restore the sample.
            </p>
          )}
          <div className="grid gap-3 md:grid-cols-2">
            {projects.map((project) => {
              const stats = runtimeStats(project);
              return (
                <article key={project.id} className="rounded-lg border border-line bg-elevated p-4">
                  <Link
                    to="/studio/$projectId"
                    params={{ projectId: project.id }}
                    className="focus-ring block rounded-sm"
                  >
                    <p className="text-xs tracking-[0.14em] text-crimson uppercase">{project.aspect} · {project.targetMinutes} min</p>
                    <h3 className="mt-1 font-display text-3xl leading-none font-medium">{project.title}</h3>
                    <p className="mt-3 line-clamp-2 text-sm text-muted">{project.logline || "No logline yet."}</p>
                    <p className="mt-4 font-mono text-xs text-faint tabular-nums">
                      Planned {formatClock(stats.planned)} · Filmed {formatClock(stats.filmed)} · {stats.filmedCount}/{stats.shotCount} clips
                    </p>
                  </Link>
                  <div className="mt-3">
                    {pendingDelete === project.id ? (
                      <div className="flex gap-2">
                        <Button variant="danger" onClick={() => { deleteProject(project.id); setPendingDelete(null); }}>
                          Confirm delete
                        </Button>
                        <Button variant="ghost" onClick={() => setPendingDelete(null)}>
                          Keep
                        </Button>
                      </div>
                    ) : (
                      <Button variant="ghost" onClick={() => setPendingDelete(project.id)}>
                        Delete
                      </Button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line pb-2">
      <dt className="text-muted">{k}</dt>
      <dd className="text-right text-fg tabular-nums">{v}</dd>
    </div>
  );
}
