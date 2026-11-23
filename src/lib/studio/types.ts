export type Section =
  | "story"
  | "cast"
  | "board"
  | "cut"
  | "sound"
  | "prompts"
  | "pages"
  | "desk"
  | "vault";

export type ShotStatus = "planned" | "generating" | "ready" | "failed" | "approved";

export type VideoModel = "grok-imagine-video-1.5-lite" | "grok-imagine-video-1.5";

export type Aspect = "16:9" | "9:16" | "21:9" | "1:1";

export type Resolution = "480p" | "720p" | "1080p";

export interface Character {
  id: string;
  name: string;
  appearance: string;
  clothing: string;
  personality: string;
  voice: string;
  referenceDataUrl?: string;
}

export interface Shot {
  id: string;
  sequenceId: string;
  title: string;
  prompt: string;
  dialogue: string;
  subtitle: string;
  seconds: number;
  trimIn: number;
  trimOut: number;
  status: ShotStatus;
  videoUrl?: string;
  posterDataUrl?: string;
  error?: string;
  model: VideoModel;
  resolution: Resolution;
  requestId?: string;
}

export interface Sequence {
  id: string;
  title: string;
  minutes: number;
  summary: string;
  shotIds: string[];
}

export interface JsonPrompt {
  id: string;
  name: string;
  body: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
}

export interface AudioTake {
  id: string;
  label: string;
  voice: string;
  text: string;
  audioDataUrl?: string;
  error?: string;
}

export interface Rates {
  litePerSec: number;
  standardPerSec: number;
  image: number;
}

export interface Project {
  id: string;
  title: string;
  logline: string;
  treatment: string;
  language: string;
  aspect: Aspect;
  targetMinutes: number;
  screenplay: string;
  characters: Character[];
  sequences: Sequence[];
  shots: Shot[];
  prompts: JsonPrompt[];
  chat: ChatMessage[];
  takes: AudioTake[];
  rates: Rates;
  createdAt: number;
  updatedAt: number;
}

export const DEFAULT_RATES: Rates = {
  litePerSec: 0.02,
  standardPerSec: 0.08,
  image: 0.04,
};

export const SECTIONS: { id: Section; label: string }[] = [
  { id: "story", label: "Story" },
  { id: "cast", label: "Cast" },
  { id: "board", label: "Board" },
  { id: "cut", label: "Cut" },
  { id: "sound", label: "Sound" },
  { id: "prompts", label: "Prompts" },
  { id: "pages", label: "Pages" },
  { id: "desk", label: "Desk" },
  { id: "vault", label: "Vault" },
];
