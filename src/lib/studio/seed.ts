import { DEFAULT_RATES, type Project } from "@/lib/studio/types";
import { uid } from "@/lib/studio/plan";

export const SAMPLE_ID = "sample-crimson-gate";

export function sampleProject(now = Date.now()): Project {
  const sequences = [
    {
      id: "seq-house",
      title: "The Last House",
      minutes: 10,
      summary:
        "Ila closes the drowned city's last cinema. A reel marked with tomorrow's date starts by itself.",
      shotIds: ["shot-1", "shot-2", "shot-3", "shot-4", "shot-5", "shot-6"],
    },
    {
      id: "seq-reel",
      title: "The Reel",
      minutes: 12,
      summary: "Frames show Ila opening a gate she has never seen, hours from now, in a red coat she does not own.",
      shotIds: [],
    },
    {
      id: "seq-double",
      title: "The Double",
      minutes: 12,
      summary: "The Usher offers her the ending in exchange for sitting still in the front row.",
      shotIds: [],
    },
    {
      id: "seq-salt",
      title: "Salt and Static",
      minutes: 14,
      summary: "Marin's voice on a dead phone leads Ila through flooded streets toward the crimson gate.",
      shotIds: [],
    },
    {
      id: "seq-assembly",
      title: "The Assembly",
      minutes: 12,
      summary: "She cuts the reel herself, keeping only the shots that do not spend her.",
      shotIds: [],
    },
    {
      id: "seq-credits",
      title: "Credits of a Life",
      minutes: 10,
      summary: "Dawn. The cinema is dark. Ila walks out wearing her own coat. The gate stays shut.",
      shotIds: [],
    },
  ];

  const shot = (
    id: string,
    title: string,
    seconds: number,
    prompt: string,
    dialogue: string,
    subtitle: string,
  ) => ({
    id,
    sequenceId: "seq-house",
    title,
    prompt,
    dialogue,
    subtitle,
    seconds,
    trimIn: 0,
    trimOut: 0,
    status: "planned" as const,
    model: "grok-imagine-video-1.5-lite" as const,
    resolution: "480p" as const,
  });

  return {
    id: SAMPLE_ID,
    title: "The Crimson Gate",
    logline:
      "A night projectionist in a drowned city finds a reel of a film that has not been shot yet — and the lead looks exactly like her.",
    treatment:
      "The picture runs seventy minutes in six movements. Ila Voss shuts the last cinema on a coast the tide has already taken. A canister labeled with tomorrow's date threads itself. On the screen she watches a version of herself open a crimson gate. The Usher, who sells endings, wants her to sit in the front row and let that version finish the story. Her brother Marin speaks through a phone that has no signal. Ila refuses the offered ending, cuts the reel down to the shots she chooses, and walks into a dawn the film did not predict. The gate remains closed.",
    language: "English",
    aspect: "21:9",
    targetMinutes: 70,
    screenplay: `INT. THE LAST HOUSE — NIGHT

Rain ticks on the roof of a cinema the sea has not quite claimed. ILA VOSS, 34, salt-grey coat, threads a platter.

ILA
House is closed. If you're sitting in the dark, you already paid.

The projector answers by itself. A leader flashes tomorrow's date.

EXT. ALLEY BEHIND THE CINEMA — NIGHT

THE USHER waits under a bulb, crimson gloves, black wool. He does not step into the rain.

USHER
You can watch it, or you can cut it. You cannot do both.

Ila looks at her hands. They are not the hands on the screen.`,
    characters: [
      {
        id: "char-ila",
        name: "Ila Voss",
        appearance: "34, short dark hair, tired grey eyes, a small scar at the left brow, olive skin",
        clothing: "Salt-grey wool coat, black turtleneck, worn leather boots",
        personality: "Precise, dry, refuses to be directed",
        voice: "Low, unhurried, almost a whisper in the booth",
      },
      {
        id: "char-usher",
        name: "The Usher",
        appearance: "Ageless, pale, still as a title card, no visible age lines",
        clothing: "Black wool coat, crimson gloves, narrow dark tie",
        personality: "Polite, transactional, never raises his voice",
        voice: "Even, as if reading credits aloud",
      },
      {
        id: "char-marin",
        name: "Marin Voss",
        appearance: "Ila's younger brother, usually only a voice; when seen, rain-soaked, same dark hair",
        clothing: "Faded work jacket, no gloves",
        personality: "Warm, frightened, believes the film can be bargained with",
        voice: "Bright, frayed by static",
      },
    ],
    sequences,
    shots: [
      shot(
        "shot-1",
        "Booth, last house",
        8,
        "Night interior of an old cinema projection booth, rain on a high window, a woman in a salt-grey coat threading film, practical tungsten light, cinematic, no on-screen text",
        "House is closed.",
        "House is closed.",
      ),
      shot(
        "shot-2",
        "Tomorrow's leader",
        6,
        "Extreme close-up of celluloid leader flashing a date that is tomorrow, dust in the beam, shallow focus, no readable words if possible",
        "",
        "",
      ),
      shot(
        "shot-3",
        "Screen lights alone",
        8,
        "Empty cinema seats, a screen igniting by itself, cold beam through haze, wide cinematic frame",
        "",
        "",
      ),
      shot(
        "shot-4",
        "The offered coat",
        8,
        "On a cinema screen, a woman who looks like Ila Voss wears a crimson coat she does not own and reaches for a tall red gate, film grain, night",
        "",
        "That is not my coat.",
      ),
      shot(
        "shot-5",
        "Usher in the alley",
        10,
        "An ageless usher in a black coat and crimson gloves stands under one bulb in a rainy alley behind a cinema, he does not enter the rain, cinematic, restrained",
        "You can watch it, or you can cut it.",
        "You can watch it, or you can cut it.",
      ),
      shot(
        "shot-6",
        "Her own hands",
        6,
        "Close-up of Ila's real hands, salt-grey sleeves, contrasted with flickering light from a screen, intimate, no text",
        "You cannot do both.",
        "You cannot do both.",
      ),
    ],
    prompts: [
      {
        id: uid(),
        name: "Gate, text to video",
        body: JSON.stringify(
          {
            provider: "xai-video-lite",
            mode: "text-to-video",
            prompt:
              "A tall crimson gate at the end of a flooded street at night, cinema light in the puddles, slow push in, no text",
            duration: 8,
            aspect_ratio: "21:9",
            resolution: "480p",
            dialogue: "",
            character: "Ila Voss",
          },
          null,
          2,
        ),
      },
    ],
    chat: [],
    takes: [],
    rates: { ...DEFAULT_RATES },
    createdAt: now,
    updatedAt: now,
  };
}

export function blankProject(input: {
  title: string;
  targetMinutes: number;
  aspect: Project["aspect"];
  language: string;
}): Project {
  const now = Date.now();
  const sequenceId = uid();
  return {
    id: uid(),
    title: input.title.trim() || "Untitled picture",
    logline: "",
    treatment: "",
    language: input.language,
    aspect: input.aspect,
    targetMinutes: input.targetMinutes,
    screenplay: "",
    characters: [],
    sequences: [
      {
        id: sequenceId,
        title: "Opening",
        minutes: Math.min(10, input.targetMinutes),
        summary: "",
        shotIds: [],
      },
    ],
    shots: [],
    prompts: [],
    chat: [],
    takes: [],
    rates: { ...DEFAULT_RATES },
    createdAt: now,
    updatedAt: now,
  };
}
