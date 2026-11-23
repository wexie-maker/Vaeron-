import { useState } from "react";
import { Button, Field, Panel, SpendDialog, fieldClass } from "@/components/studio/ui";
import { breakSequence, generateStill } from "@/lib/studio/ai";
import { formatClock, formatMoney, sequenceRuntime, shotCost, slatesToAdd, uid } from "@/lib/studio/plan";
import { useStudio } from "@/lib/studio/store";
import type { Project, Shot } from "@/lib/studio/types";

export function BoardView({ project }: { project: Project }) {
  const updateProject = useStudio((state) => state.updateProject);
  const aiAvailable = useStudio((state) => state.aiAvailable);
  const [openId, setOpenId] = useState(project.sequences[0]?.id ?? "");
  const [slateSeconds, setSlateSeconds] = useState(10);
  const [pendingFill, setPendingFill] = useState<string | null>(null);
  const [pendingWrite, setPendingWrite] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [stillFor, setStillFor] = useState<string | null>(null);

  const sequence = project.sequences.find((item) => item.id === openId) ?? project.sequences[0];

  function patchSequence(id: string, partial: Partial<Project["sequences"][number]>) {
    updateProject(project.id, (current) => ({
      ...current,
      sequences: current.sequences.map((item) => (item.id === id ? { ...item, ...partial } : item)),
    }));
  }

  function addShots(sequenceId: string, shots: Shot[]) {
    if (shots.length === 0) {
      useStudio.getState().setNotice("This sequence already covers its runtime.");
      return;
    }
    updateProject(project.id, (current) => ({
      ...current,
      shots: [...current.shots, ...shots],
      sequences: current.sequences.map((item) =>
        item.id === sequenceId ? { ...item, shotIds: [...item.shotIds, ...shots.map((shot) => shot.id)] } : item,
      ),
    }));
  }

  async function writeShots() {
    if (!sequence) return;
    setBusy(true);
    setPendingWrite(null);
    try {
      const result = await breakSequence({
        data: {
          title: sequence.title,
          summary: sequence.summary || project.treatment || project.logline,
          language: project.language,
          characterNotes: project.characters.map((character) => `${character.name}: ${character.appearance}`).join("; "),
        },
      });
      if (!result.ok) {
        useStudio.getState().setNotice(result.error);
        return;
      }
      addShots(
        sequence.id,
        result.shots.map((shot) => ({
          id: uid(),
          sequenceId: sequence.id,
          title: shot.title,
          prompt: shot.prompt,
          dialogue: shot.dialogue,
          subtitle: shot.subtitle,
          seconds: shot.seconds,
          trimIn: 0,
          trimOut: 0,
          status: "planned" as const,
          model: "grok-imagine-video-1.5-lite" as const,
          resolution: "480p" as const,
        })),
      );
    } catch (error) {
      useStudio.getState().setNotice(error instanceof Error ? error.message : "Could not break the sequence.");
    } finally {
      setBusy(false);
    }
  }

  async function still() {
    if (!stillFor) return;
    const shot = project.shots.find((item) => item.id === stillFor);
    setBusy(true);
    const shotId = stillFor;
    setStillFor(null);
    try {
      if (!shot) return;
      const cast = project.characters.map((character) => `${character.name}, ${character.appearance}, ${character.clothing}`).join(". ");
      const result = await generateStill({
        data: { prompt: `${shot.prompt}. ${cast}. Cinematic film still, no text.`.slice(0, 2000) },
      });
      if (!result.ok) {
        useStudio.getState().setNotice(result.error);
        return;
      }
      useStudio.getState().patchShot(project.id, shotId, { posterDataUrl: result.dataUrl });
    } catch (error) {
      useStudio.getState().setNotice(error instanceof Error ? error.message : "Still failed.");
    } finally {
      setBusy(false);
    }
  }

  const fillCount = sequence ? slatesToAdd(project, sequence, slateSeconds).length : 0;

  return (
    <div className="grid gap-4">
      <Panel
        eyebrow="Storyboard"
        title="Sequences"
        action={
          <Button
            variant="solid"
            onClick={() => {
              const id = uid();
              updateProject(project.id, (current) => ({
                ...current,
                sequences: [...current.sequences, { id, title: "New sequence", minutes: 5, summary: "", shotIds: [] }],
              }));
              setOpenId(id);
            }}
          >
            Add sequence
          </Button>
        }
      >
        <div className="flex gap-2 overflow-x-auto pb-1">
          {project.sequences.map((item, index) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setOpenId(item.id)}
              className={`focus-ring min-h-11 shrink-0 rounded-sm border px-3 text-left text-sm ${item.id === sequence?.id ? "border-line bg-subtle text-fg" : "border-transparent text-muted"}`}
            >
              {index + 1}. {item.title}
              <span className="mt-0.5 block font-mono text-xs text-faint tabular-nums">{item.minutes} min</span>
            </button>
          ))}
        </div>
      </Panel>
      {sequence && (
        <Panel eyebrow="Sequence" title={sequence.title}>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Title">
              <input className={fieldClass} value={sequence.title} onChange={(event) => patchSequence(sequence.id, { title: event.target.value })} />
            </Field>
            <Field label="Runtime (minutes)">
              <input
                className={fieldClass}
                type="number"
                min={1}
                max={120}
                value={sequence.minutes}
                onChange={(event) => patchSequence(sequence.id, { minutes: Math.min(120, Math.max(1, Number(event.target.value) || 1)) })}
              />
            </Field>
            <div className="md:col-span-2">
              <Field label="Summary">
                <textarea className={`${fieldClass} min-h-24`} value={sequence.summary} onChange={(event) => patchSequence(sequence.id, { summary: event.target.value })} />
              </Field>
            </div>
          </div>
          <p className="mt-3 font-mono text-xs text-faint tabular-nums">
            Blocked {formatClock(sequenceRuntime(project, sequence))} of {formatClock(sequence.minutes * 60)}
          </p>
          <div className="mt-4 flex flex-wrap items-end gap-2">
            <Field label="Slate length">
              <select className={fieldClass} value={slateSeconds} onChange={(event) => setSlateSeconds(Number(event.target.value))}>
                {[5, 8, 10, 15].map((value) => (
                  <option key={value} value={value}>
                    {value}s
                  </option>
                ))}
              </select>
            </Field>
            <Button onClick={() => setPendingFill(sequence.id)}>Block runtime · free</Button>
            <Button variant="solid" disabled={aiAvailable === false} onClick={() => setPendingWrite(sequence.id)}>
              Write shots with AI
            </Button>
            {project.sequences.length > 1 && (
              <Button
                variant="danger"
                onClick={() => {
                  updateProject(project.id, (current) => ({
                    ...current,
                    sequences: current.sequences.filter((item) => item.id !== sequence.id),
                    shots: current.shots.filter((shot) => shot.sequenceId !== sequence.id),
                  }));
                  setOpenId("");
                }}
              >
                Delete sequence
              </Button>
            )}
          </div>
          <div className="mt-4 grid gap-3">
            {sequence.shotIds.map((id, index) => {
              const shot = project.shots.find((item) => item.id === id);
              if (!shot) return null;
              return (
                <ShotEditor
                  key={shot.id}
                  index={index}
                  shot={shot}
                  cost={formatMoney(shotCost(project, shot))}
                  onChange={(partial) => useStudio.getState().patchShot(project.id, shot.id, partial)}
                  onStill={() => setStillFor(shot.id)}
                  aiOff={aiAvailable === false}
                  onMove={(direction) => moveShot(project, sequence.id, shot.id, direction)}
                  onRemove={() => removeShot(project, shot.id)}
                />
              );
            })}
            {sequence.shotIds.length === 0 && (
              <p className="text-sm text-muted">No shots yet. Block the runtime locally, or ask for a short written list.</p>
            )}
          </div>
        </Panel>
      )}
      <SpendDialog
        open={pendingFill === sequence?.id}
        title="Block this sequence"
        eyebrow="Local only"
        cost="No charge"
        body={
          fillCount === 0
            ? "The slates already cover this sequence."
            : `This adds ${fillCount} planned slates of ${slateSeconds}s. Local only. A single pass stops at 80 slates so the board stays usable. Run it again if time remains. Nothing is rendered.`
        }
        confirmLabel="Add slates"
        onCancel={() => setPendingFill(null)}
        onConfirm={() => {
          if (sequence) addShots(sequence.id, slatesToAdd(project, sequence, slateSeconds));
          setPendingFill(null);
        }}
      />
      <SpendDialog
        open={Boolean(pendingWrite)}
        title="Write the shots"
        cost="Text quota"
        body="One writing request returns 6 to 10 hero shots. It does not fill the whole picture and does not render video."
        confirmLabel="Write shots"
        busy={busy}
        onCancel={() => setPendingWrite(null)}
        onConfirm={() => void writeShots()}
      />
      <SpendDialog
        open={Boolean(stillFor)}
        title="Generate a still"
        cost={`About ${formatMoney(project.rates.image)}`}
        body="One image for this shot. If you later render a clip, this still is sent as the starting frame. Face consistency still depends on the model."
        confirmLabel="Generate still"
        busy={busy}
        onCancel={() => setStillFor(null)}
        onConfirm={() => void still()}
      />
    </div>
  );
}

function moveShot(project: Project, sequenceId: string, shotId: string, direction: -1 | 1) {
  useStudio.getState().updateProject(project.id, (current) => ({
    ...current,
    sequences: current.sequences.map((sequence) => {
      if (sequence.id !== sequenceId) return sequence;
      const ids = [...sequence.shotIds];
      const index = ids.indexOf(shotId);
      const next = index + direction;
      if (index < 0 || next < 0 || next >= ids.length) return sequence;
      const [item] = ids.splice(index, 1);
      if (item) ids.splice(next, 0, item);
      return { ...sequence, shotIds: ids };
    }),
  }));
}

function removeShot(project: Project, shotId: string) {
  useStudio.getState().updateProject(project.id, (current) => ({
    ...current,
    shots: current.shots.filter((shot) => shot.id !== shotId),
    sequences: current.sequences.map((sequence) => ({
      ...sequence,
      shotIds: sequence.shotIds.filter((id) => id !== shotId),
    })),
  }));
}

function ShotEditor({
  shot,
  index,
  cost,
  onChange,
  onStill,
  onMove,
  onRemove,
  aiOff,
}: {
  shot: Shot;
  index: number;
  cost: string;
  onChange: (partial: Partial<Shot>) => void;
  onStill: () => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
  aiOff: boolean;
}) {
  return (
    <article className="grid gap-3 rounded-md border border-line bg-bg p-3 md:grid-cols-[120px_1fr]">
      <div className="overflow-hidden rounded-sm border border-line bg-subtle">
        {shot.posterDataUrl ? (
          <img src={shot.posterDataUrl} alt="" className="aspect-video w-full object-cover" />
        ) : (
          <div className="flex aspect-video items-center justify-center text-xs text-faint">No still</div>
        )}
      </div>
      <div className="grid gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-mono text-xs text-faint tabular-nums">
            {index + 1} · {shot.seconds}s · from {cost} · {shot.status}
          </p>
          <div className="flex gap-1">
            <Button className="px-3" onClick={() => onMove(-1)}>Up</Button>
            <Button className="px-3" onClick={() => onMove(1)}>Down</Button>
          </div>
        </div>
        <input className={fieldClass} value={shot.title} onChange={(event) => onChange({ title: event.target.value })} />
        <textarea className={`${fieldClass} min-h-20`} value={shot.prompt} onChange={(event) => onChange({ prompt: event.target.value })} />
        <div className="grid gap-2 sm:grid-cols-2">
          <input className={fieldClass} value={shot.dialogue} placeholder="Dialogue" onChange={(event) => onChange({ dialogue: event.target.value })} />
          <input className={fieldClass} value={shot.subtitle} placeholder="Subtitle" onChange={(event) => onChange({ subtitle: event.target.value })} />
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="text-xs text-muted">
            Seconds
            <input
              className={`${fieldClass} mt-1 w-24`}
              type="number"
              min={1}
              max={15}
              value={shot.seconds}
              onChange={(event) => onChange({ seconds: Math.min(15, Math.max(1, Number(event.target.value) || 1)) })}
            />
          </label>
          <Button disabled={aiOff} onClick={onStill}>Still</Button>
          <Button variant="ghost" onClick={onRemove}>Remove</Button>
        </div>
      </div>
    </article>
  );
}
