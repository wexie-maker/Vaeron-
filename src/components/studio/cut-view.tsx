import { useRef, useState } from "react";
import { ClapperStripes } from "@/components/studio/mark";
import { Button, Panel, SpendDialog, fieldClass } from "@/components/studio/ui";
import { resumeShot, runShot } from "@/lib/studio/jobs";
import {
  buildSrt,
  downloadText,
  formatClock,
  formatMoney,
  orderedShots,
  playSeconds,
  runtimeStats,
  shotCost,
} from "@/lib/studio/plan";
import { useStudio } from "@/lib/studio/store";
import type { Project, Resolution, Shot, VideoModel } from "@/lib/studio/types";

export function CutView({ project }: { project: Project }) {
  const shots = orderedShots(project);
  const stats = runtimeStats(project);
  const aiAvailable = useStudio((state) => state.aiAvailable);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [spendId, setSpendId] = useState<string | null>(null);
  const playingRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const current = shots[Math.min(index, Math.max(0, shots.length - 1))];
  const spendShot = shots.find((shot) => shot.id === spendId);

  function stop() {
    playingRef.current = false;
    setPlaying(false);
    videoRef.current?.pause();
  }

  async function playFrom(start: number) {
    stop();
    playingRef.current = true;
    setPlaying(true);
    for (let cursor = start; cursor < 500; cursor += 1) {
      if (!playingRef.current) break;
      const live = useStudio.getState().projects.find((item) => item.id === project.id);
      if (!live) break;
      const list = orderedShots(live);
      const shot = list[cursor];
      if (!shot) break;
      setIndex(cursor);
      if (shot.videoUrl) await playClip(shot);
      else await wait(1200);
      if (!playingRef.current) break;
    }
    setPlaying(false);
    playingRef.current = false;
  }

  function playClip(shot: Shot) {
    return new Promise<void>((resolve) => {
      const element = videoRef.current;
      if (!element || !shot.videoUrl) {
        resolve();
        return;
      }
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        element.removeEventListener("ended", finish);
        element.removeEventListener("error", finish);
        element.removeEventListener("timeupdate", onTime);
        resolve();
      };
      const onTime = () => {
        const end = shot.trimOut > shot.trimIn ? shot.trimOut : Number.POSITIVE_INFINITY;
        if (element.currentTime >= end - 0.05) {
          element.pause();
          finish();
        }
      };
      element.addEventListener("ended", finish);
      element.addEventListener("error", finish);
      element.addEventListener("timeupdate", onTime);
      element.src = shot.videoUrl;
      element.onloadedmetadata = () => {
        const startAt = Math.min(shot.trimIn || 0, Math.max(0, element.duration - 0.2));
        element.currentTime = startAt;
        void element.play().catch(() => finish());
      };
    });
  }

  return (
    <div className="grid gap-4">
      <Panel
        eyebrow="Assembly"
        title="Cut"
        action={
          <Button
            onClick={() => downloadText(`${slug(project.title)}.srt`, buildSrt(project), "application/x-subrip")}
          >
            Download subtitles
          </Button>
        }
      >
        <p className="text-sm text-muted">
          Target {formatClock(stats.target)} · planned {formatClock(stats.planned)} · filmed {formatClock(stats.filmed)}.
          Floor to film every remaining second of the target on lite 480p: {formatMoney(stats.fullTargetFloor)}.
          Clips already on the board, not yet rendered: about {formatMoney(stats.unfilmedCost)}. Estimates only.
        </p>
        <div className="mt-4 overflow-hidden rounded-md border border-line bg-bg">
          <div className="relative bg-bg" style={{ aspectRatio: project.aspect.replace(":", " / ") }}>
            <video ref={videoRef} className={`h-full w-full ${current?.videoUrl ? "block" : "hidden"}`} playsInline />
            {(!current || !current.videoUrl) && (
              <div className="absolute inset-0 flex flex-col">
                <ClapperStripes />
                <div className="flex flex-1 flex-col justify-center p-5">
                  <p className="text-xs tracking-[0.16em] text-crimson uppercase">Slate · not rendered</p>
                  <p className="mt-2 max-w-xl font-display text-4xl leading-none">{current?.title ?? "No shots"}</p>
                  <p className="mt-3 text-sm text-muted">
                    {current ? `${current.seconds} seconds planned. Render is a separate approval.` : "Board the picture first."}
                  </p>
                </div>
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-3 py-3">
            <p className="max-w-xl text-sm text-fg">{current?.subtitle || current?.dialogue || "No subtitle"}</p>
            <div className="flex gap-2">
              <Button variant="solid" disabled={shots.length === 0} onClick={() => void playFrom(index)}>
                {playing ? "Replay" : "Play cut"}
              </Button>
              <Button disabled={!playing} onClick={stop}>
                Stop
              </Button>
              <Button
                disabled={!current || aiAvailable === false || current.status === "generating"}
                onClick={() => current && setSpendId(current.id)}
              >
                {current?.status === "generating" ? "Rendering…" : "Render this clip"}
              </Button>
            </div>
          </div>
        </div>
        <p className="mt-3 text-xs text-faint">
          Slates without a clip rehearse for a moment so you can walk the structure. Real clips play at their trimmed length. A single movie file is not mixed here — download each clip from its link. Links from the renderer expire.
        </p>
      </Panel>
      <div className="grid gap-2">
        {shots.map((shot, shotIndex) => (
          <article key={shot.id} className={`rounded-md border bg-elevated p-3 ${shotIndex === index ? "border-crimson" : "border-line"}`}>
            <button type="button" className="focus-ring w-full text-left" onClick={() => { stop(); setIndex(shotIndex); }}>
              <span className="font-mono text-xs text-faint tabular-nums">
                {shotIndex + 1} · {shot.status} · {shot.videoUrl ? formatClock(playSeconds(shot)) : `${shot.seconds}s planned`}
              </span>
              <span className="mt-1 block text-sm text-fg">{shot.title}</span>
            </button>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <label className="text-xs text-muted">
                Model
                <select
                  className={`${fieldClass} mt-1`}
                  value={shot.model}
                  onChange={(event) => useStudio.getState().patchShot(project.id, shot.id, { model: event.target.value as VideoModel })}
                >
                  <option value="grok-imagine-video-1.5-lite">Video 1.5 Lite · lower rate</option>
                  <option value="grok-imagine-video-1.5">Video 1.5 · higher rate</option>
                </select>
              </label>
              <label className="text-xs text-muted">
                Resolution
                <select
                  className={`${fieldClass} mt-1`}
                  value={shot.resolution}
                  onChange={(event) => useStudio.getState().patchShot(project.id, shot.id, { resolution: event.target.value as Resolution })}
                >
                  <option value="480p">480p · default, cheaper</option>
                  <option value="720p">720p · costs more</option>
                  <option value="1080p">1080p · costs more</option>
                </select>
              </label>
              <label className="text-xs text-muted">
                Trim in
                <input
                  className={`${fieldClass} mt-1`}
                  type="number"
                  min={0}
                  max={15}
                  step={0.1}
                  value={shot.trimIn}
                  onChange={(event) => useStudio.getState().patchShot(project.id, shot.id, { trimIn: Number(event.target.value) || 0 })}
                />
              </label>
              <label className="text-xs text-muted">
                Trim out (0 = end)
                <input
                  className={`${fieldClass} mt-1`}
                  type="number"
                  min={0}
                  max={15}
                  step={0.1}
                  value={shot.trimOut}
                  onChange={(event) => useStudio.getState().patchShot(project.id, shot.id, { trimOut: Number(event.target.value) || 0 })}
                />
              </label>
            </div>
            <label className="mt-2 block text-xs text-muted">
              Subtitle
              <input
                className={`${fieldClass} mt-1`}
                value={shot.subtitle}
                onChange={(event) => useStudio.getState().patchShot(project.id, shot.id, { subtitle: event.target.value })}
              />
            </label>
            {shot.error && <p className="mt-2 text-sm text-crimson">{shot.error}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="solid"
                disabled={aiAvailable === false || shot.status === "generating"}
                onClick={() => setSpendId(shot.id)}
              >
                {shot.status === "generating" ? "Rendering…" : shot.videoUrl ? "Regenerate clip" : "Render clip"}
              </Button>
              {shot.requestId && shot.status !== "generating" && (
                <Button onClick={() => void resumeShot(project.id, shot.id)}>Check render</Button>
              )}
              <Button
                onClick={() =>
                  useStudio.getState().patchShot(project.id, shot.id, {
                    status: shot.status === "approved" ? "ready" : "approved",
                  })
                }
              >
                {shot.status === "approved" ? "Approved" : "Approve"}
              </Button>
              {shot.videoUrl && (
                <a className="focus-ring inline-flex min-h-11 items-center rounded-sm border border-line px-4 text-sm" href={shot.videoUrl} target="_blank" rel="noreferrer">
                  Open clip
                </a>
              )}
            </div>
          </article>
        ))}
      </div>
      <SpendDialog
        open={Boolean(spendShot)}
        title={spendShot?.videoUrl ? "Regenerate this clip" : "Render this clip"}
        cost={spendShot ? `From ${formatMoney(shotCost(project, spendShot))}` : ""}
        body={
          spendShot
            ? `${Math.min(15, spendShot.seconds)}s · ${spendShot.model.endsWith("lite") ? "Lite" : "Standard"} · ${spendShot.resolution}. Higher resolutions cost more than this floor. Only this shot is sent. The rest of the movie is not rendered.`
            : ""
        }
        confirmLabel="Approve and render"
        onCancel={() => setSpendId(null)}
        onConfirm={() => {
          if (!spendShot) return;
          const id = spendShot.id;
          setSpendId(null);
          void runShot(project.id, id);
        }}
      />
    </div>
  );
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "vaeron";
}
