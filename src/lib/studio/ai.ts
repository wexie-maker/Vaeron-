import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const AspectSchema = z.enum(["16:9", "9:16", "21:9", "1:1"]);
const ResolutionSchema = z.enum(["480p", "720p", "1080p"]);
const ModelSchema = z.enum(["grok-imagine-video-1.5-lite", "grok-imagine-video-1.5"]);

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new Error(result.error.issues[0]?.message ?? "Invalid request");
  }
  return result.data;
}

async function apiError(response: Response): Promise<string> {
  const text = await response.text();
  return `xAI returned ${response.status}. ${text.slice(0, 280)}`;
}

function keyOrError(): { ok: true; key: string } | { ok: false; error: string } {
  const key = process.env.XAI_API_KEY;
  if (!key) return { ok: false, error: "AI is not available in this environment." };
  return { ok: true, key };
}

export const aiStatus = createServerFn({ method: "GET" }).handler(async () => {
  return { available: Boolean(process.env.XAI_API_KEY) };
});

const ChatSchema = z.object({
  language: z.string().max(40),
  context: z.string().max(2500),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        text: z.string().max(4000),
      }),
    )
    .max(12),
});

export const askAssistant = createServerFn({ method: "POST" })
  .validator((input: unknown) => parse(ChatSchema, input))
  .handler(async ({ data }) => {
    const auth = keyOrError();
    if (!auth.ok) return auth;
    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${auth.key}`,
      },
      body: JSON.stringify({
        model: "grok-4.5",
        max_tokens: 900,
        messages: [
          {
            role: "system",
            content: `You are the story assistant inside Vaeron AI, a private movie studio. Write in ${data.language}. Be concrete and cinematic. Never claim a clip has already been rendered. Do not suggest spending money without saying the owner must approve it.`,
          },
          {
            role: "user",
            content: `Picture context:\n${data.context || "No pages yet."}`,
          },
          ...data.messages.map((message) => ({ role: message.role, content: message.text })),
        ],
      }),
    });
    if (!response.ok) return { ok: false as const, error: await apiError(response) };
    const body = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return { ok: true as const, text: body.choices?.[0]?.message?.content?.trim() ?? "" };
  });

const StorySchema = z.object({
  title: z.string().max(120),
  logline: z.string().max(500),
  notes: z.string().max(2000),
  language: z.string().max(40),
  targetMinutes: z.number().min(70).max(120),
});

export const writeStory = createServerFn({ method: "POST" })
  .validator((input: unknown) => parse(StorySchema, input))
  .handler(async ({ data }) => {
    const auth = keyOrError();
    if (!auth.ok) return auth;
    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${auth.key}`,
      },
      body: JSON.stringify({
        model: "grok-4.5",
        max_tokens: 1800,
        messages: [
          {
            role: "system",
            content:
              "You write for a private film studio. Return only JSON with keys logline, treatment, opening. treatment covers the full runtime in prose, under 180 words. opening is at most two short scenes of screenplay. No markdown fences.",
          },
          {
            role: "user",
            content: `Language: ${data.language}. Title: ${data.title}. Target: ${data.targetMinutes} minutes assembled from clips of at most 15 seconds. Existing logline: ${data.logline}. Notes: ${data.notes}`,
          },
        ],
      }),
    });
    if (!response.ok) return { ok: false as const, error: await apiError(response) };
    const body = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = body.choices?.[0]?.message?.content ?? "";
    try {
      const parsed = looseJson(text) as {
        logline?: string;
        treatment?: string;
        opening?: string;
      };
      return {
        ok: true as const,
        logline: String(parsed.logline ?? "").slice(0, 500),
        treatment: String(parsed.treatment ?? "").slice(0, 4000),
        opening: String(parsed.opening ?? "").slice(0, 6000),
      };
    } catch {
      return { ok: false as const, error: "The writer did not return usable pages. Try again." };
    }
  });

const BreakSchema = z.object({
  title: z.string().max(120),
  summary: z.string().max(1500),
  language: z.string().max(40),
  characterNotes: z.string().max(1500),
});

export const breakSequence = createServerFn({ method: "POST" })
  .validator((input: unknown) => parse(BreakSchema, input))
  .handler(async ({ data }) => {
    const auth = keyOrError();
    if (!auth.ok) return auth;
    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${auth.key}`,
      },
      body: JSON.stringify({
        model: "grok-4.5",
        max_tokens: 1400,
        messages: [
          {
            role: "system",
            content:
              'Return only JSON: {"shots":[{"title":"","prompt":"","dialogue":"","subtitle":"","seconds":8}]}. 6 to 10 shots. seconds is an integer from 4 to 12. Prompts are visual, with no request for on-screen text.',
          },
          {
            role: "user",
            content: `Language: ${data.language}. Sequence: ${data.title}. Summary: ${data.summary}. Cast: ${data.characterNotes}`,
          },
        ],
      }),
    });
    if (!response.ok) return { ok: false as const, error: await apiError(response) };
    const body = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    try {
      const parsed = looseJson(body.choices?.[0]?.message?.content ?? "") as {
        shots?: {
          title?: string;
          prompt?: string;
          dialogue?: string;
          subtitle?: string;
          seconds?: number;
        }[];
      };
      const shots = (parsed.shots ?? []).slice(0, 10).map((shot) => ({
        title: String(shot.title ?? "Shot").slice(0, 80),
        prompt: String(shot.prompt ?? "").slice(0, 800),
        dialogue: String(shot.dialogue ?? "").slice(0, 300),
        subtitle: String(shot.subtitle ?? shot.dialogue ?? "").slice(0, 180),
        seconds: Math.min(12, Math.max(4, Math.round(Number(shot.seconds) || 8))),
      }));
      if (shots.length === 0) return { ok: false as const, error: "No shots came back." };
      return { ok: true as const, shots };
    } catch {
      return { ok: false as const, error: "Could not read the shot list. Try again." };
    }
  });

const StructureSchema = z.object({
  plain: z.string().min(1).max(2000),
  aspect: AspectSchema,
});

export const structurePrompt = createServerFn({ method: "POST" })
  .validator((input: unknown) => parse(StructureSchema, input))
  .handler(async ({ data }) => {
    const auth = keyOrError();
    if (!auth.ok) return auth;
    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${auth.key}`,
      },
      body: JSON.stringify({
        model: "grok-4.5",
        max_tokens: 500,
        messages: [
          {
            role: "system",
            content:
              'Convert the note into JSON only, no fences. Keys: provider (xai-video-lite|xai-video|xai-image|local-slate), mode (text-to-video|image-to-video|text-to-image|slate), prompt, duration (1-15), aspect_ratio, resolution (480p|720p|1080p), dialogue, character. Default to xai-video-lite, text-to-video, 480p, duration 6.',
          },
          {
            role: "user",
            content: `Aspect hint: ${data.aspect}. Note: ${data.plain}`,
          },
        ],
      }),
    });
    if (!response.ok) return { ok: false as const, error: await apiError(response) };
    const body = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    try {
      const parsed = looseJson(body.choices?.[0]?.message?.content ?? "");
      return { ok: true as const, body: JSON.stringify(parsed, null, 2) };
    } catch {
      return { ok: false as const, error: "Could not structure that note." };
    }
  });

const ImageSchema = z.object({
  prompt: z.string().min(1).max(2000),
});

export const generateStill = createServerFn({ method: "POST" })
  .validator((input: unknown) => parse(ImageSchema, input))
  .handler(async ({ data }) => {
    const auth = keyOrError();
    if (!auth.ok) return auth;
    const response = await fetch("https://api.x.ai/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${auth.key}`,
      },
      body: JSON.stringify({
        model: "grok-imagine-image-2.0",
        prompt: data.prompt,
        response_format: "b64_json",
        n: 1,
      }),
    });
    if (!response.ok) return { ok: false as const, error: await apiError(response) };
    const body = (await response.json()) as {
      data?: { b64_json?: string; url?: string }[];
    };
    const first = body.data?.[0];
    if (first?.b64_json) {
      return { ok: true as const, dataUrl: `data:image/png;base64,${first.b64_json}` };
    }
    if (first?.url) return { ok: true as const, dataUrl: first.url };
    return { ok: false as const, error: "The image response had no picture." };
  });

const VideoSchema = z.object({
  prompt: z.string().min(1).max(4000),
  duration: z.number().min(1).max(15),
  aspect: AspectSchema,
  resolution: ResolutionSchema,
  model: ModelSchema,
  imageDataUrl: z.string().max(6_000_000).optional(),
});

export const startClip = createServerFn({ method: "POST" })
  .validator((input: unknown) => parse(VideoSchema, input))
  .handler(async ({ data }) => {
    const auth = keyOrError();
    if (!auth.ok) return auth;
    const payload: Record<string, unknown> = {
      model: data.model,
      prompt: data.prompt,
      duration: Math.round(data.duration),
      resolution: data.resolution,
    };
    if (data.imageDataUrl) {
      payload.image = { url: data.imageDataUrl };
    } else {
      payload.aspect_ratio = data.aspect;
    }
    const response = await fetch("https://api.x.ai/v1/videos/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${auth.key}`,
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) return { ok: false as const, error: await apiError(response) };
    const body = (await response.json()) as { request_id?: string };
    if (!body.request_id) return { ok: false as const, error: "No request id came back." };
    return { ok: true as const, requestId: body.request_id };
  });

const PollSchema = z.object({ requestId: z.string().min(4).max(120) });

export const pollClip = createServerFn({ method: "POST" })
  .validator((input: unknown) => parse(PollSchema, input))
  .handler(async ({ data }) => {
    const auth = keyOrError();
    if (!auth.ok) return auth;
    const response = await fetch(`https://api.x.ai/v1/videos/${encodeURIComponent(data.requestId)}`, {
      headers: { Authorization: `Bearer ${auth.key}` },
    });
    if (!response.ok) return { ok: false as const, error: await apiError(response) };
    const body = (await response.json()) as {
      status?: string;
      video?: { url?: string };
      url?: string;
      error?: string;
    };
    const url = body.video?.url || body.url;
    return {
      ok: true as const,
      status: body.status ?? "pending",
      url,
      error: body.error,
    };
  });

const SpeechSchema = z.object({
  text: z.string().min(1).max(1500),
  voice: z.string().min(1).max(40),
});

export const speakLine = createServerFn({ method: "POST" })
  .validator((input: unknown) => parse(SpeechSchema, input))
  .handler(async ({ data }) => {
    const auth = keyOrError();
    if (!auth.ok) return auth;
    const response = await fetch("https://api.x.ai/v1/tts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${auth.key}`,
      },
      body: JSON.stringify({ text: data.text, voice_id: data.voice }),
    });
    if (!response.ok) return { ok: false as const, error: await apiError(response) };
    const type = response.headers.get("content-type") ?? "";
    if (type.includes("json")) {
      const body = (await response.json()) as { url?: string; audio?: string };
      if (body.url) return { ok: true as const, audioDataUrl: body.url };
      if (body.audio) return { ok: true as const, audioDataUrl: `data:audio/mpeg;base64,${body.audio}` };
      return { ok: false as const, error: "Voice came back in an unexpected shape." };
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > 4_000_000) {
      return { ok: false as const, error: "That take is too long to keep. Shorten the line." };
    }
    return { ok: true as const, audioDataUrl: `data:audio/mpeg;base64,${bytesToBase64(bytes)}` };
  });

function looseJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced?.[1] ?? trimmed;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("no json");
  return JSON.parse(raw.slice(start, end + 1));
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x2000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}
