import { z } from "zod";

export const PromptSchema = z.object({
  provider: z.enum(["xai-video-lite", "xai-video", "xai-image", "local-slate"]),
  mode: z.enum(["text-to-video", "image-to-video", "text-to-image", "slate"]),
  prompt: z.string().min(1),
  duration: z.number().min(1).max(15).optional(),
  aspect_ratio: z.enum(["16:9", "9:16", "21:9", "1:1"]).optional(),
  resolution: z.enum(["480p", "720p", "1080p"]).optional(),
  dialogue: z.string().optional(),
  character: z.string().optional(),
});

export type StructuredPrompt = z.infer<typeof PromptSchema>;

export function validatePrompt(body: string): { ok: true; value: StructuredPrompt } | { ok: false; error: string } {
  try {
    const value = PromptSchema.parse(JSON.parse(body));
    return { ok: true, value };
  } catch (error) {
    if (error instanceof z.ZodError) return { ok: false, error: error.issues[0]?.message ?? "Invalid prompt" };
    return { ok: false, error: "That is not valid JSON." };
  }
}
