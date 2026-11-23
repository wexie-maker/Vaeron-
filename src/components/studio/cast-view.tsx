import { useState } from "react";
import { Button, Field, Panel, SpendDialog, fieldClass } from "@/components/studio/ui";
import { generateStill } from "@/lib/studio/ai";
import { uid } from "@/lib/studio/plan";
import { useStudio } from "@/lib/studio/store";
import type { Character, Project } from "@/lib/studio/types";
import { formatMoney } from "@/lib/studio/plan";

const empty = (): Character => ({
  id: uid(),
  name: "",
  appearance: "",
  clothing: "",
  personality: "",
  voice: "",
});

export function CastView({ project }: { project: Project }) {
  const updateProject = useStudio((state) => state.updateProject);
  const aiAvailable = useStudio((state) => state.aiAvailable);
  const [selected, setSelected] = useState(project.characters[0]?.id ?? "");
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  const character = project.characters.find((item) => item.id === selected) ?? project.characters[0];

  function write(next: Character[]) {
    updateProject(project.id, (current) => ({ ...current, characters: next }));
  }

  function update(partial: Partial<Character>) {
    if (!character) return;
    write(project.characters.map((item) => (item.id === character.id ? { ...item, ...partial } : item)));
  }

  async function portrait() {
    if (!character) return;
    setBusy(true);
    setAsk(false);
    try {
      const prompt = `Cinematic character portrait, neutral background, no text. ${character.name}. ${character.appearance}. Clothing: ${character.clothing}. Consistent face, film still.`;
      const result = await generateStill({ data: { prompt } });
      if (!result.ok) {
        useStudio.getState().setNotice(result.error);
        return;
      }
      const latest = useStudio.getState().projects.find((item) => item.id === project.id);
      if (!latest) return;
      updateProject(project.id, (current) => ({
        ...current,
        characters: current.characters.map((item) =>
          item.id === character.id ? { ...item, referenceDataUrl: result.dataUrl } : item,
        ),
      }));
    } catch (error) {
      useStudio.getState().setNotice(error instanceof Error ? error.message : "Portrait failed.");
    } finally {
      setBusy(false);
    }
  }

  async function onFile(file: File) {
    if (!character) return;
    const dataUrl = await resizeImage(file);
    update({ referenceDataUrl: dataUrl });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
      <Panel title="Cast">
        <div className="flex flex-col gap-1">
          {project.characters.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelected(item.id)}
              className={`focus-ring min-h-11 rounded-sm px-3 text-left text-sm ${item.id === character?.id ? "bg-subtle text-fg" : "text-muted"}`}
            >
              {item.name || "Unnamed"}
            </button>
          ))}
        </div>
        <Button
          className="mt-3 w-full"
          onClick={() => {
            const next = empty();
            write([...project.characters, next]);
            setSelected(next.id);
          }}
        >
          Add character
        </Button>
      </Panel>
      {character ? (
        <Panel
          eyebrow="Character studio"
          title={character.name || "New character"}
          action={
            <Button variant="danger" onClick={() => {
              write(project.characters.filter((item) => item.id !== character.id));
              setSelected("");
            }}>
              Remove
            </Button>
          }
        >
          <div className="grid gap-4 md:grid-cols-[180px_1fr]">
            <div>
              <div className="flex aspect-[3/4] items-center justify-center overflow-hidden rounded-md border border-line bg-bg">
                {character.referenceDataUrl ? (
                  <img src={character.referenceDataUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <p className="px-3 text-center text-xs text-faint">No reference yet</p>
                )}
              </div>
              <div className="mt-2 flex flex-col gap-2">
                <Button variant="solid" disabled={aiAvailable === false || busy} onClick={() => setAsk(true)}>
                  Generate portrait
                </Button>
                <label className="focus-ring inline-flex min-h-11 cursor-pointer items-center justify-center rounded-sm border border-line px-3 text-sm">
                  Upload photo
                  <input
                    className="sr-only"
                    type="file"
                    accept="image/*"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void onFile(file);
                      event.target.value = "";
                    }}
                  />
                </label>
                {character.referenceDataUrl && (
                  <Button variant="ghost" onClick={() => update({ referenceDataUrl: undefined })}>
                    Remove reference
                  </Button>
                )}
              </div>
            </div>
            <div className="grid gap-3">
              <Field label="Name">
                <input className={fieldClass} value={character.name} onChange={(event) => update({ name: event.target.value })} />
              </Field>
              <Field label="Appearance">
                <textarea className={`${fieldClass} min-h-20`} value={character.appearance} onChange={(event) => update({ appearance: event.target.value })} />
              </Field>
              <Field label="Clothing">
                <textarea className={`${fieldClass} min-h-16`} value={character.clothing} onChange={(event) => update({ clothing: event.target.value })} />
              </Field>
              <Field label="Personality">
                <textarea className={`${fieldClass} min-h-16`} value={character.personality} onChange={(event) => update({ personality: event.target.value })} />
              </Field>
              <Field label="Voice">
                <input className={fieldClass} value={character.voice} onChange={(event) => update({ voice: event.target.value })} />
              </Field>
              <p className="text-xs leading-relaxed text-faint">
                Reference photos aim for a consistent face on image-to-video. The model does not guarantee a lock. Use only photos you have the right to use.
              </p>
            </div>
          </div>
        </Panel>
      ) : (
        <Panel title="No cast yet">
          <p className="text-sm text-muted">Add a character to reuse their look, clothes, and voice in later shots.</p>
        </Panel>
      )}
      <SpendDialog
        open={ask}
        title="Generate a portrait"
        cost={`About ${formatMoney(project.rates.image)}`}
        body="One still, billed around the published image rate. It is saved in this browser as the character reference. No video is made."
        confirmLabel="Generate still"
        busy={busy}
        onCancel={() => setAsk(false)}
        onConfirm={() => void portrait()}
      />
    </div>
  );
}

function resizeImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read that image"));
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const scale = Math.min(1, 1024 / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("Could not read that image"));
          return;
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      image.onerror = () => reject(new Error("Could not read that image"));
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
