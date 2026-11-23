import { pollClip, startClip } from "@/lib/studio/ai";
import { useStudio } from "@/lib/studio/store";
import type { Character, Project, Shot } from "@/lib/studio/types";

const running = new Set<string>();

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function clipPrompt(project: Project, shot: Shot): string {
  const cast = project.characters
    .map((character) => describeCharacter(character))
    .filter(Boolean)
    .join("\n");
  const dialogue = shot.dialogue.trim() ? `Spoken line, if the model can voice it: "${shot.dialogue.trim()}"` : "";
  return [shot.prompt.trim(), cast && `Cast lock:\n${cast}`, dialogue, "Cinematic, consistent faces and wardrobe. No titles or captions in frame."]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 4000);
}

function describeCharacter(character: Character): string {
  if (!character.name.trim()) return "";
  return `${character.name}: ${character.appearance}. Clothing: ${character.clothing}. Voice: ${character.voice}.`;
}

export function referenceImage(project: Project, shot: Shot): string | undefined {
  if (shot.posterDataUrl) return shot.posterDataUrl;
  return project.characters.find((character) => character.referenceDataUrl)?.referenceDataUrl;
}

export async function runShot(projectId: string, shotId: string): Promise<void> {
  if (running.has(shotId)) return;
  const project = useStudio.getState().projects.find((item) => item.id === projectId);
  const shot = project?.shots.find((item) => item.id === shotId);
  if (!project || !shot) return;
  running.add(shotId);
  const patch = (partial: Partial<Shot>) => useStudio.getState().patchShot(projectId, shotId, partial);
  patch({ status: "generating", error: undefined });
  try {
    const image = referenceImage(project, shot);
    const started = await startClip({
      data: {
        prompt: clipPrompt(project, shot),
        duration: Math.min(15, Math.max(1, Math.round(shot.seconds))),
        aspect: project.aspect,
        resolution: shot.resolution,
        model: shot.model,
        imageDataUrl: image,
      },
    });
    if (!started.ok) {
      patch({ status: "failed", error: started.error });
      return;
    }
    patch({ requestId: started.requestId });
    await followRequest(projectId, shotId, started.requestId);
  } catch (error) {
    patch({
      status: "failed",
      error: error instanceof Error ? error.message : "The clip did not start.",
    });
  } finally {
    running.delete(shotId);
  }
}

export async function resumeShot(projectId: string, shotId: string): Promise<void> {
  const project = useStudio.getState().projects.find((item) => item.id === projectId);
  const shot = project?.shots.find((item) => item.id === shotId);
  if (!shot?.requestId || running.has(shotId)) return;
  running.add(shotId);
  useStudio.getState().patchShot(projectId, shotId, { status: "generating", error: undefined });
  try {
    await followRequest(projectId, shotId, shot.requestId);
  } finally {
    running.delete(shotId);
  }
}

async function followRequest(projectId: string, shotId: string, requestId: string) {
  const patch = (partial: Partial<Shot>) => useStudio.getState().patchShot(projectId, shotId, partial);
  for (let attempt = 0; attempt < 90; attempt += 1) {
    await sleep(4000);
    const polled = await pollClip({ data: { requestId } });
    if (!polled.ok) {
      patch({ status: "failed", error: polled.error, requestId });
      return;
    }
    if (polled.status === "done" && polled.url) {
      patch({ status: "ready", videoUrl: polled.url, error: undefined, requestId });
      useStudio.getState().setNotice("Clip is ready. The link is temporary — open or download it from the cut.");
      return;
    }
    if (polled.status === "failed" || polled.status === "expired") {
      patch({
        status: "failed",
        error: polled.error || `Render ${polled.status}.`,
        requestId,
      });
      return;
    }
  }
  patch({
    status: "failed",
    error: "Still rendering. Use Check render — this does not start a second clip.",
    requestId,
  });
}
