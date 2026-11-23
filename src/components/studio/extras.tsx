import { useState } from "react";
import { Button, Field, Panel, SpendDialog, fieldClass } from "@/components/studio/ui";
import { askAssistant, speakLine, structurePrompt } from "@/lib/studio/ai";
import { extractPdfText } from "@/lib/studio/pdf";
import { downloadBlob, downloadText, makePdf, orderedShots, scenesFromText, uid } from "@/lib/studio/plan";
import { validatePrompt } from "@/lib/studio/prompt-schema";
import { useStudio } from "@/lib/studio/store";
import type { ChatMessage, Project } from "@/lib/studio/types";

export function SoundView({ project }: { project: Project }) {
  const updateProject = useStudio((state) => state.updateProject);
  const aiAvailable = useStudio((state) => state.aiAvailable);
  const [text, setText] = useState("");
  const [voice, setVoice] = useState("eve");
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);

  async function speak() {
    setBusy(true);
    setAsk(false);
    const id = uid();
    updateProject(project.id, (current) => ({
      ...current,
      takes: [...current.takes, { id, label: `Take ${current.takes.length + 1}`, voice, text }].slice(-8),
    }));
    try {
      const result = await speakLine({ data: { text, voice } });
      useStudio.getState().updateProject(project.id, (current) => ({
        ...current,
        takes: current.takes.map((take) =>
          take.id === id
            ? { ...take, audioDataUrl: result.ok ? result.audioDataUrl : undefined, error: result.ok ? undefined : result.error }
            : take,
        ),
      }));
      if (!result.ok) useStudio.getState().setNotice(result.error);
    } catch (error) {
      useStudio.getState().setNotice(error instanceof Error ? error.message : "Voice failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4">
      <Panel eyebrow="Audio" title="Booth">
        <p className="mb-4 text-sm text-muted">
          Video clips can carry their own sound. Narration here is a separate take — it is not mixed into the picture automatically.
          Default voice id is eve. Other ids work only if the account has them. Marked working only after a take succeeds.
        </p>
        <Field label="Line">
          <textarea className={`${fieldClass} min-h-28`} maxLength={1500} value={text} onChange={(event) => setText(event.target.value)} />
        </Field>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <Field label="Voice id">
            <input className={fieldClass} value={voice} onChange={(event) => setVoice(event.target.value)} />
          </Field>
          <Button variant="solid" disabled={!text.trim() || aiAvailable === false} onClick={() => setAsk(true)}>
            Speak
          </Button>
        </div>
      </Panel>
      {project.takes.map((take) => (
        <Panel key={take.id} title={take.label} eyebrow={take.voice}>
          <p className="text-sm text-muted">{take.text}</p>
          {take.audioDataUrl && <audio className="mt-3 w-full" controls src={take.audioDataUrl} />}
          {take.error && <p className="mt-2 text-sm text-crimson">{take.error}</p>}
          <Button
            className="mt-3"
            variant="ghost"
            onClick={() =>
              updateProject(project.id, (current) => ({
                ...current,
                takes: current.takes.filter((item) => item.id !== take.id),
              }))
            }
          >
            Delete take
          </Button>
        </Panel>
      ))}
      <SpendDialog
        open={ask}
        title="Speak this line"
        cost="Voice quota"
        body="One text-to-speech request, capped at 1,500 characters. It spends xAI voice usage. It does not score the movie."
        confirmLabel="Speak"
        busy={busy}
        onCancel={() => setAsk(false)}
        onConfirm={() => void speak()}
      />
    </div>
  );
}

export function PromptView({ project }: { project: Project }) {
  const updateProject = useStudio((state) => state.updateProject);
  const aiAvailable = useStudio((state) => state.aiAvailable);
  const [name, setName] = useState("Untitled prompt");
  const [body, setBody] = useState(
    '{\n  "provider": "xai-video-lite",\n  "mode": "text-to-video",\n  "prompt": "",\n  "duration": 6,\n  "aspect_ratio": "16:9",\n  "resolution": "480p",\n  "dialogue": "",\n  "character": ""\n}',
  );
  const [plain, setPlain] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function save() {
    const checked = validatePrompt(body);
    if (!checked.ok) {
      setMessage(checked.error);
      return;
    }
    updateProject(project.id, (current) => ({
      ...current,
      prompts: [...current.prompts, { id: uid(), name: name.trim() || "Prompt", body: JSON.stringify(checked.value, null, 2) }],
    }));
    setMessage("Saved.");
  }

  function apply(raw: string) {
    const checked = validatePrompt(raw);
    if (!checked.ok) {
      setMessage(checked.error);
      return;
    }
    const sequence = project.sequences[0];
    if (!sequence) return;
    const id = uid();
    const value = checked.value;
    updateProject(project.id, (current) => ({
      ...current,
      shots: [
        ...current.shots,
        {
          id,
          sequenceId: sequence.id,
          title: name || "Prompt shot",
          prompt: value.prompt,
          dialogue: value.dialogue ?? "",
          subtitle: value.dialogue ?? "",
          seconds: value.duration ?? 6,
          trimIn: 0,
          trimOut: 0,
          status: "planned",
          model: value.provider === "xai-video" ? "grok-imagine-video-1.5" : "grok-imagine-video-1.5-lite",
          resolution: value.resolution ?? "480p",
        },
      ],
      sequences: current.sequences.map((item, index) =>
        index === 0 ? { ...item, shotIds: [...item.shotIds, id] } : item,
      ),
    }));
    setMessage(value.provider === "local-slate" ? "Added as a local slate. No render." : "Added to the first sequence. Render it from the cut when you approve the cost.");
  }

  async function structure() {
    setBusy(true);
    try {
      const result = await structurePrompt({ data: { plain, aspect: project.aspect } });
      if (!result.ok) setMessage(result.error);
      else {
        setBody(result.body);
        setMessage("Structured. Check it before saving.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not structure that.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel eyebrow="JSON prompt studio" title="Editor">
        <p className="mb-3 text-sm text-muted">
          Providers: xai-video-lite and xai-video spend credits when you render. xai-image is a still. local-slate never calls out.
        </p>
        <Field label="Name">
          <input className={fieldClass} value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <label className="mt-3 block">
          <span className="mb-1.5 block text-xs font-medium text-muted">JSON</span>
          <textarea className={`${fieldClass} min-h-64 font-mono text-xs`} value={body} onChange={(event) => setBody(event.target.value)} />
        </label>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button onClick={() => {
            const checked = validatePrompt(body);
            setMessage(checked.ok ? "Valid." : checked.error);
          }}>Validate</Button>
          <Button variant="solid" onClick={save}>Save</Button>
          <Button onClick={() => apply(body)}>Add to board</Button>
        </div>
        {message && <p className="mt-3 text-sm text-muted">{message}</p>}
        <div className="mt-5 border-t border-line pt-4">
          <Field label="Plain language">
            <textarea className={`${fieldClass} min-h-20`} value={plain} onChange={(event) => setPlain(event.target.value)} />
          </Field>
          <Button className="mt-3" disabled={!plain.trim() || aiAvailable === false || busy} onClick={() => void structure()}>
            {busy ? "Structuring…" : "Structure with AI"}
          </Button>
          <p className="mt-2 text-xs text-faint">One short text request. It does not render.</p>
        </div>
      </Panel>
      <Panel title="Saved">
        <div className="grid gap-3">
          {project.prompts.length === 0 && <p className="text-sm text-muted">None saved yet.</p>}
          {project.prompts.map((prompt) => (
            <article key={prompt.id} className="rounded-md border border-line bg-bg p-3">
              <h3 className="text-sm font-medium">{prompt.name}</h3>
              <pre className="mt-2 max-h-32 overflow-auto font-mono text-xs whitespace-pre-wrap text-muted">{prompt.body}</pre>
              <div className="mt-2 flex gap-2">
                <Button onClick={() => { setName(prompt.name); setBody(prompt.body); }}>Edit</Button>
                <Button onClick={() => apply(prompt.body)}>Add to board</Button>
                <Button
                  variant="ghost"
                  onClick={() =>
                    updateProject(project.id, (current) => ({
                      ...current,
                      prompts: current.prompts.filter((item) => item.id !== prompt.id),
                    }))
                  }
                >
                  Delete
                </Button>
              </div>
            </article>
          ))}
        </div>
      </Panel>
    </div>
  );
}

export function PagesView({ project }: { project: Project }) {
  const updateProject = useStudio((state) => state.updateProject);
  const [text, setText] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const scenes = scenesFromText(text);

  async function onPdf(file: File) {
    setNote("Reading…");
    try {
      const extracted = await extractPdfText(await file.arrayBuffer());
      setText(extracted);
      setNote(`Read ${file.name}. First 30 pages, text only.`);
    } catch (error) {
      setNote(error instanceof Error ? error.message : "Could not read that PDF.");
    }
  }

  function exportPlan() {
    const shots = orderedShots(project);
    const body = [
      project.logline,
      "",
      project.treatment,
      "",
      ...project.sequences.flatMap((sequence) => [
        `${sequence.title} (${sequence.minutes} min)`,
        sequence.summary,
        ...sequence.shotIds.map((id) => {
          const shot = shots.find((item) => item.id === id);
          return shot ? `- ${shot.title} (${shot.seconds}s) ${shot.prompt}` : "";
        }),
        "",
      ]),
    ].join("\n");
    downloadBlob(`${project.title}-plan.pdf`, makePdf(project.title, body));
    downloadText(`${project.title}-plan.txt`, body);
  }

  return (
    <div className="grid gap-4">
      <Panel eyebrow="PDF studio" title="Pages in">
        <p className="mb-3 text-sm text-muted">
          Upload a text PDF or paste a story. Scanned pages without text will not read. Nothing is uploaded except what you later choose to render.
        </p>
        <label className="focus-ring inline-flex min-h-11 cursor-pointer items-center rounded-sm border border-line px-4 text-sm">
          Upload PDF
          <input
            className="sr-only"
            type="file"
            accept="application/pdf"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void onPdf(file);
              event.target.value = "";
            }}
          />
        </label>
        <textarea className={`${fieldClass} mt-3 min-h-48`} value={text} onChange={(event) => setText(event.target.value)} placeholder="Paste a story or screenplay" />
        {note && <p className="mt-2 text-sm text-muted">{note}</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            variant="solid"
            disabled={!text.trim()}
            onClick={() => {
              updateProject(project.id, (current) => ({
                ...current,
                screenplay: current.screenplay ? `${current.screenplay}\n\n${text}` : text,
              }));
              setNote("Added to the screenplay.");
            }}
          >
            Send to story
          </Button>
          <Button
            disabled={scenes.length === 0}
            onClick={() => {
              updateProject(project.id, (current) => ({
                ...current,
                sequences: [
                  ...current.sequences,
                  ...scenes.map((scene) => ({
                    id: uid(),
                    title: scene.title,
                    minutes: 2,
                    summary: scene.body,
                    shotIds: [],
                  })),
                ],
              }));
              setNote(`Added ${scenes.length} sequences. They are plans, not clips.`);
            }}
          >
            Scenes to sequences
          </Button>
        </div>
        {scenes.length > 0 && (
          <ul className="mt-4 grid gap-2">
            {scenes.slice(0, 8).map((scene) => (
              <li key={scene.title} className="rounded-sm border border-line px-3 py-2 text-sm">
                <span className="text-fg">{scene.title}</span>
                <span className="mt-1 block line-clamp-2 text-muted">{scene.body}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel eyebrow="Export" title="Pages out">
        <p className="mb-3 text-sm text-muted">
          PDF export uses a basic Latin font. A UTF-8 text file is saved with it so other languages survive.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => {
              const body = `${project.logline}\n\n${project.treatment}\n\n${project.screenplay}`;
              downloadBlob(`${project.title}-screenplay.pdf`, makePdf(project.title, body));
              downloadText(`${project.title}-screenplay.txt`, body);
            }}
          >
            Export screenplay
          </Button>
          <Button onClick={exportPlan}>Export plan</Button>
        </div>
      </Panel>
    </div>
  );
}

export function DeskView({ project }: { project: Project }) {
  const updateProject = useStudio((state) => state.updateProject);
  const aiAvailable = useStudio((state) => state.aiAvailable);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [incoming, setIncoming] = useState("");
  const [tone, setTone] = useState("brief");
  const [reply, setReply] = useState("");

  async function send(content: string) {
    const userMessage: ChatMessage = { id: uid(), role: "user", text: content };
    const history = [...project.chat, userMessage].slice(-12);
    updateProject(project.id, (current) => ({ ...current, chat: [...current.chat, userMessage].slice(-40) }));
    setText("");
    setBusy(true);
    try {
      const context = `${project.title}\n${project.logline}\n${project.treatment.slice(0, 800)}\n${project.screenplay.slice(0, 800)}`;
      const result = await askAssistant({
        data: {
          language: project.language,
          context,
          messages: history.map((message) => ({ role: message.role, text: message.text })),
        },
      });
      const answer = result.ok ? result.text : result.error;
      updateProject(project.id, (current) => ({
        ...current,
        chat: [...current.chat, { id: uid(), role: "assistant" as const, text: answer }].slice(-40),
      }));
    } catch (error) {
      useStudio.getState().setNotice(error instanceof Error ? error.message : "The desk could not answer.");
    } finally {
      setBusy(false);
    }
  }

  function localReply() {
    const toneLine =
      tone === "firm"
        ? "I can't do that, but here is what I can do."
        : tone === "formal"
          ? "Thank you for writing. I will respond in full shortly."
          : tone === "warm"
            ? "Thank you — I appreciate you sending this."
            : "Thanks. I'll get back to you shortly.";
    setReply(`${toneLine}\n\nAbout: ${incoming.trim().slice(0, 240)}`);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel eyebrow="Assistant" title="Desk">
        <p className="mb-3 text-sm text-muted">Brainstorm, revise a prompt, or troubleshoot a scene. Each send is one text request. It does not render.</p>
        <div className="grid max-h-96 gap-3 overflow-auto">
          {project.chat.length === 0 && <p className="text-sm text-faint">No notes yet.</p>}
          {project.chat.map((message) => (
            <p key={message.id} className={`text-sm ${message.role === "user" ? "text-fg" : "text-muted"}`}>
              <span className="mr-2 text-xs tracking-wide text-faint uppercase">{message.role}</span>
              {message.text}
            </p>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {["Tighten the logline", "Write a harder ending", "What is weak in the opening?"].map((prompt) => (
            <Button key={prompt} disabled={aiAvailable === false || busy} onClick={() => void send(prompt)}>
              {prompt}
            </Button>
          ))}
        </div>
        <textarea className={`${fieldClass} mt-3 min-h-20`} value={text} onChange={(event) => setText(event.target.value)} />
        <Button className="mt-3" variant="solid" disabled={!text.trim() || aiAvailable === false || busy} onClick={() => void send(text.trim())}>
          {busy ? "Writing…" : "Send"}
        </Button>
      </Panel>
      <Panel eyebrow="Messages" title="Reply helper">
        <p className="mb-3 text-sm text-muted">A local draft is free. Polish uses one text request.</p>
        <Field label="Incoming message">
          <textarea className={`${fieldClass} min-h-24`} value={incoming} onChange={(event) => setIncoming(event.target.value)} />
        </Field>
        <Field label="Tone">
          <select className={`${fieldClass} mt-3`} value={tone} onChange={(event) => setTone(event.target.value)}>
            <option value="brief">Brief</option>
            <option value="warm">Warm</option>
            <option value="firm">Firm</option>
            <option value="formal">Formal</option>
          </select>
        </Field>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button onClick={localReply} disabled={!incoming.trim()}>Local draft</Button>
          <Button
            variant="solid"
            disabled={!incoming.trim() || aiAvailable === false || busy}
            onClick={() =>
              void send(`Draft a ${tone} reply to this message. Return only the reply.\n\n${incoming}`).then(() => {
                const chat = useStudio.getState().projects.find((item) => item.id === project.id)?.chat ?? [];
                const last = [...chat].reverse().find((message) => message.role === "assistant");
                if (last) setReply(last.text);
              })
            }
          >
            Polish with AI
          </Button>
        </div>
        <textarea className={`${fieldClass} mt-3 min-h-28`} value={reply} onChange={(event) => setReply(event.target.value)} />
        <Button className="mt-3" disabled={!reply} onClick={() => void navigator.clipboard.writeText(reply)}>
          Copy reply
        </Button>
      </Panel>
    </div>
  );
}

export function VaultView({ project }: { project: Project }) {
  const updateProject = useStudio((state) => state.updateProject);
  const deleteProject = useStudio((state) => state.deleteProject);
  const [armed, setArmed] = useState(false);

  return (
    <div className="grid gap-4">
      <Panel eyebrow="Privacy" title="This picture stays here">
        <ul className="grid gap-2 text-sm text-muted">
          <li>Projects, stills, and drafts are stored in this browser. Closing the tab does not erase them.</li>
          <li>A render sends that prompt, and a reference image if you attached one, to xAI. The key stays on the server.</li>
          <li>There is no public gallery. Deleting a picture removes it from this device.</li>
        </ul>
      </Panel>
      <Panel eyebrow="Cost" title="Rates you are estimating with">
        <p className="mb-3 text-sm text-muted">
          These are published floors you can edit if the price list changes. They are not a live invoice. 480p lite is the default. 720p and 1080p cost more than the floor.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Rate label="Lite $ / sec" value={project.rates.litePerSec} onChange={(litePerSec) => updateProject(project.id, (current) => ({ ...current, rates: { ...current.rates, litePerSec } }))} />
          <Rate label="Standard $ / sec" value={project.rates.standardPerSec} onChange={(standardPerSec) => updateProject(project.id, (current) => ({ ...current, rates: { ...current.rates, standardPerSec } }))} />
          <Rate label="Image $" value={project.rates.image} onChange={(image) => updateProject(project.id, (current) => ({ ...current, rates: { ...current.rates, image } }))} />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Target minutes (70 to 120)">
            <input
              className={fieldClass}
              type="number"
              min={70}
              max={120}
              value={project.targetMinutes}
              onChange={(event) =>
                updateProject(project.id, (current) => ({
                  ...current,
                  targetMinutes: Math.min(120, Math.max(70, Number(event.target.value) || 70)),
                }))
              }
            />
          </Field>
          <Field label="Language">
            <input className={fieldClass} value={project.language} onChange={(event) => updateProject(project.id, (current) => ({ ...current, language: event.target.value }))} />
          </Field>
        </div>
      </Panel>
      <Panel eyebrow="Honest labels" title="What is actually on">
        <table className="w-full text-left text-sm">
          <tbody>
            {[
              ["Story, cast, board, cut, subtitles, backup", "On · this browser"],
              ["PDF read and export", "On · text PDFs, Latin PDF plus UTF-8"],
              ["JSON prompts", "On · local validate"],
              ["Story, shots, chat, reply polish", "On when AI is available · text quota"],
              ["Stills and portraits", "On when you approve · about image rate"],
              ["Clips up to 15 seconds", "On when you approve · per second"],
              ["Feature-length file", "Not automatic · assemble and download clips"],
              ["Perfect face lock", "Not guaranteed"],
              ["Free unlimited video", "Unavailable"],
            ].map(([feature, state]) => (
              <tr key={feature} className="border-t border-line">
                <td className="py-2 pr-3 text-fg">{feature}</td>
                <td className="py-2 text-muted">{state}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
      <Panel title="Backup and deletion">
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => downloadText(`${project.title}-backup.json`, JSON.stringify(project), "application/json")}
          >
            Download backup
          </Button>
          {armed ? (
            <Button
              variant="danger"
              onClick={() => {
                deleteProject(project.id);
                window.location.assign("/");
              }}
            >
              Confirm delete
            </Button>
          ) : (
            <Button variant="danger" onClick={() => setArmed(true)}>
              Delete picture
            </Button>
          )}
        </div>
      </Panel>
    </div>
  );
}

function Rate({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <Field label={label}>
      <input
        className={fieldClass}
        type="number"
        min={0}
        step={0.01}
        value={value}
        onChange={(event) => onChange(Math.max(0, Number(event.target.value) || 0))}
      />
    </Field>
  );
}
