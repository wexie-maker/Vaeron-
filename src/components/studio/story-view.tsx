import { useState } from "react";
import { Button, Field, Panel, SpendDialog, fieldClass } from "@/components/studio/ui";
import { writeStory } from "@/lib/studio/ai";
import { useStudio } from "@/lib/studio/store";
import type { Project } from "@/lib/studio/types";

export function StoryView({ project }: { project: Project }) {
  const updateProject = useStudio((state) => state.updateProject);
  const aiAvailable = useStudio((state) => state.aiAvailable);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [ask, setAsk] = useState(false);
  const [draft, setDraft] = useState<{ logline: string; treatment: string; opening: string } | null>(null);

  function patch(partial: Partial<Project>) {
    updateProject(project.id, (current) => ({ ...current, ...partial }));
  }

  async function run() {
    setBusy(true);
    setAsk(false);
    try {
      const result = await writeStory({
        data: {
          title: project.title,
          logline: project.logline,
          notes,
          language: project.language,
          targetMinutes: project.targetMinutes,
        },
      });
      if (!result.ok) {
        useStudio.getState().setNotice(result.error);
        return;
      }
      setDraft({ logline: result.logline, treatment: result.treatment, opening: result.opening });
    } catch (error) {
      useStudio.getState().setNotice(error instanceof Error ? error.message : "The writer failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4">
      <Panel
        eyebrow="Story"
        title="Pages"
        action={
          <Button variant="solid" disabled={aiAvailable === false || busy} onClick={() => setAsk(true)}>
            Write with AI
          </Button>
        }
      >
        <p className="mb-4 text-sm text-muted">
          A text request drafts a logline, a treatment for the full runtime, and a short opening. It does not render video.
          {aiAvailable === false && " AI is unavailable here, so the pages stay yours to type."}
        </p>
        <div className="grid gap-4">
          <Field label="Logline">
            <textarea className={`${fieldClass} min-h-20`} value={project.logline} onChange={(event) => patch({ logline: event.target.value })} />
          </Field>
          <Field label="Treatment — the whole runtime">
            <textarea className={`${fieldClass} min-h-36`} value={project.treatment} onChange={(event) => patch({ treatment: event.target.value })} />
          </Field>
          <Field label="Screenplay opening">
            <textarea className={`${fieldClass} min-h-64 font-mono text-xs leading-relaxed`} value={project.screenplay} onChange={(event) => patch({ screenplay: event.target.value })} />
          </Field>
          <Field label="Notes for the writer">
            <textarea className={`${fieldClass} min-h-20`} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Tone, ending, what must not change" />
          </Field>
        </div>
      </Panel>
      {draft && (
        <Panel eyebrow="Draft" title="Apply these pages?" action={<Button variant="ghost" onClick={() => setDraft(null)}>Discard</Button>}>
          <p className="text-sm text-fg">{draft.logline}</p>
          <p className="mt-3 text-sm text-muted">{draft.treatment}</p>
          <pre className="mt-3 max-h-48 overflow-auto font-mono text-xs whitespace-pre-wrap text-muted">{draft.opening}</pre>
          <Button
            className="mt-4"
            variant="solid"
            onClick={() => {
              patch({
                logline: draft.logline || project.logline,
                treatment: draft.treatment || project.treatment,
                screenplay: draft.opening || project.screenplay,
              });
              setDraft(null);
            }}
          >
            Apply to the picture
          </Button>
        </Panel>
      )}
      <SpendDialog
        open={ask}
        title="Draft the pages"
        cost="Text quota"
        body="One writing request. No image, no video, no automatic charge beyond your xAI text usage. You can discard the draft."
        confirmLabel="Write"
        busy={busy}
        onCancel={() => setAsk(false)}
        onConfirm={() => void run()}
      />
    </div>
  );
}
