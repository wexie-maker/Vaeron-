import type { Project, Sequence, Shot, VideoModel } from "@/lib/studio/types";

export function uid(): string {
  return crypto.randomUUID();
}

export function orderedShots(project: Project): Shot[] {
  const byId = new Map(project.shots.map((shot) => [shot.id, shot]));
  const ordered: Shot[] = [];
  for (const sequence of project.sequences) {
    for (const id of sequence.shotIds) {
      const shot = byId.get(id);
      if (shot) ordered.push(shot);
    }
  }
  return ordered;
}

export function playSeconds(shot: Shot): number {
  const end = shot.trimOut > shot.trimIn ? shot.trimOut : shot.seconds;
  return Math.max(0.4, Math.min(15, end - shot.trimIn));
}

export function rateFor(project: Project, model: VideoModel): number {
  return model === "grok-imagine-video-1.5" ? project.rates.standardPerSec : project.rates.litePerSec;
}

export function shotCost(project: Project, shot: Shot): number {
  return Math.min(15, Math.max(1, shot.seconds)) * rateFor(project, shot.model);
}

export interface RuntimeStats {
  planned: number;
  filmed: number;
  target: number;
  shotCount: number;
  filmedCount: number;
  unfilmedCost: number;
  fullTargetFloor: number;
}

export function runtimeStats(project: Project): RuntimeStats {
  const shots = orderedShots(project);
  const planned = shots.reduce((sum, shot) => sum + shot.seconds, 0);
  const filmedShots = shots.filter((shot) => shot.videoUrl);
  const filmed = filmedShots.reduce((sum, shot) => sum + playSeconds(shot), 0);
  const unfilmedCost = shots
    .filter((shot) => !shot.videoUrl)
    .reduce((sum, shot) => sum + shotCost(project, shot), 0);
  return {
    planned,
    filmed,
    target: project.targetMinutes * 60,
    shotCount: shots.length,
    filmedCount: filmedShots.length,
    unfilmedCost,
    fullTargetFloor: project.targetMinutes * 60 * project.rates.litePerSec,
  };
}

export function sequenceRuntime(project: Project, sequence: Sequence): number {
  return sequence.shotIds.reduce((sum, id) => {
    const shot = project.shots.find((item) => item.id === id);
    return sum + (shot?.seconds ?? 0);
  }, 0);
}

export function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function formatMoney(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(amount);
}

const MAX_BATCH = 80;

export function slatesToAdd(project: Project, sequence: Sequence, slateSeconds: number): Shot[] {
  const have = sequenceRuntime(project, sequence);
  const goal = Math.round(sequence.minutes * 60);
  const gap = Math.max(0, goal - have);
  const length = Math.min(15, Math.max(1, Math.round(slateSeconds)));
  const count = Math.min(MAX_BATCH, Math.ceil(gap / length));
  const start = sequence.shotIds.length;
  return Array.from({ length: count }, (_, index) => ({
    id: uid(),
    sequenceId: sequence.id,
    title: `${sequence.title} ${start + index + 1}`,
    prompt: `${sequence.title}. ${sequence.summary || "Coverage slate."} Shot ${start + index + 1}.`,
    dialogue: "",
    subtitle: "",
    seconds: length,
    trimIn: 0,
    trimOut: 0,
    status: "planned" as const,
    model: "grok-imagine-video-1.5-lite" as const,
    resolution: "480p" as const,
  }));
}

export function buildSrt(project: Project): string {
  let cursor = 0;
  const blocks: string[] = [];
  let index = 1;
  for (const shot of orderedShots(project)) {
    const duration = shot.videoUrl ? playSeconds(shot) : shot.seconds;
    const line = (shot.subtitle || shot.dialogue).trim();
    if (line) {
      blocks.push(
        `${index}\n${stamp(cursor)} --> ${stamp(cursor + duration)}\n${line}\n`,
      );
      index += 1;
    }
    cursor += duration;
  }
  return blocks.join("\n");
}

function stamp(total: number): string {
  const ms = Math.max(0, Math.round(total * 1000));
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const millis = ms % 1000;
  const pad = (value: number, size = 2) => String(value).padStart(size, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)},${pad(millis, 3)}`;
}

export function downloadText(filename: string, text: string, type = "text/plain"): void {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function scenesFromText(text: string): { title: string; body: string }[] {
  const cleaned = text.replace(/\r/g, "").trim();
  if (!cleaned) return [];
  const parts = cleaned
    .split(/\n(?=(?:INT\.|EXT\.|INT\/EXT\.|I\/E\.|SCENE\s+\d+))/i)
    .map((part) => part.trim())
    .filter(Boolean);
  const chunks = parts.length > 1 ? parts : chunkByLength(cleaned, 900);
  return chunks.slice(0, 40).map((body, index) => {
    const first = body.split("\n")[0]?.trim() || `Scene ${index + 1}`;
    return { title: first.slice(0, 80), body: body.slice(0, 2000) };
  });
}

function chunkByLength(text: string, size: number): string[] {
  const chunks: string[] = [];
  for (let index = 0; index < text.length && chunks.length < 40; index += size) {
    chunks.push(text.slice(index, index + size));
  }
  return chunks;
}

function pdfEscape(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function latinize(value: string): string {
  return value
    .replace(/\r/g, "")
    .split("")
    .map((char) => (char.charCodeAt(0) <= 255 ? char : "?"))
    .join("");
}

export function makePdf(title: string, body: string): Blob {
  const lines = latinize(`${title}\n\n${body}`)
    .split("\n")
    .flatMap((line) => wrapLine(line, 90));
  const pages: string[][] = [];
  for (let index = 0; index < lines.length; index += 46) {
    pages.push(lines.slice(index, index + 46));
  }
  if (pages.length === 0) pages.push([title]);

  const objects: string[] = [];
  const pageIds: number[] = [];
  let nextId = 3;
  const fontId = 3;
  nextId = 4;

  for (const page of pages) {
    const contentId = nextId++;
    const pageId = nextId++;
    pageIds.push(pageId);
    const commands = page
      .map((line, lineIndex) => {
        const y = 750 - lineIndex * 14;
        return `BT /F1 11 Tf 54 ${y} Td (${pdfEscape(line)}) Tj ET`;
      })
      .join("\n");
    objects.push(`${contentId} 0 obj\n<< /Length ${commands.length} >>\nstream\n${commands}\nendstream\nendobj\n`);
    objects.push(
      `${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${fontId} 0 R >> >> >>\nendobj\n`,
    );
  }

  const kids = pageIds.map((id) => `${id} 0 R`).join(" ");
  const catalog = `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`;
  const pageTree = `2 0 obj\n<< /Type /Pages /Count ${pageIds.length} /Kids [${kids}] >>\nendobj\n`;
  const font = `${fontId} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`;
  const all = [catalog, pageTree, font, ...objects];
  let built = "%PDF-1.4\n";
  const offsets = [0];
  for (const object of all) {
    offsets.push(built.length);
    built += object;
  }
  const xrefAt = built.length;
  let xref = `xref\n0 ${offsets.length}\n0000000000 65535 f \n`;
  for (let index = 1; index < offsets.length; index += 1) {
    xref += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  built += `${xref}trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF`;
  return new Blob([built], { type: "application/pdf" });
}

function wrapLine(line: string, width: number): string[] {
  if (line.length <= width) return [line];
  const words = line.split(" ");
  const rows: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > width && current) {
      rows.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) rows.push(current);
  return rows.length ? rows : [""];
}

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
