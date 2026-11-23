import { create } from "zustand";
import { deleteProjectRecord, loadProjects, saveProject } from "@/lib/studio/idb";
import { uid } from "@/lib/studio/plan";
import { blankProject, SAMPLE_ID, sampleProject } from "@/lib/studio/seed";
import type { Project, Section, Shot } from "@/lib/studio/types";

interface StudioState {
  ready: boolean;
  projects: Project[];
  section: Section;
  notice: string | null;
  aiAvailable: boolean | null;
  hydrate: () => Promise<void>;
  setAiAvailable: (value: boolean) => void;
  setSection: (section: Section) => void;
  setNotice: (notice: string | null) => void;
  createProject: (project: Project) => void;
  ensureSample: () => void;
  deleteProject: (id: string) => void;
  importProject: (project: Project) => void;
  updateProject: (id: string, recipe: (project: Project) => Project) => void;
  patchShot: (projectId: string, shotId: string, partial: Partial<Shot>) => void;
}

const timers = new Map<string, ReturnType<typeof setTimeout>>();

function queueSave(id: string) {
  const existing = timers.get(id);
  if (existing) clearTimeout(existing);
  timers.set(
    id,
    setTimeout(() => {
      const project = useStudio.getState().projects.find((item) => item.id === id);
      if (project) void saveProject(project);
    }, 250),
  );
}

function touch(project: Project): Project {
  return { ...project, updatedAt: Date.now() };
}

function ensureFeatureLength(project: Project): Project {
  if (project.targetMinutes >= 70) return project;
  const bump = 70 - project.targetMinutes;
  return {
    ...project,
    targetMinutes: 70,
    sequences: project.sequences.map((sequence, index) =>
      index === project.sequences.length - 1 ? { ...sequence, minutes: sequence.minutes + bump } : sequence,
    ),
    updatedAt: Date.now(),
  };
}

let hydrating = false;

export const useStudio = create<StudioState>((set, get) => ({
  ready: false,
  projects: [],
  section: "story",
  notice: null,
  aiAvailable: null,
  hydrate: async () => {
    if (hydrating || get().ready) return;
    hydrating = true;
    try {
      const stored = await loadProjects();
      const source = stored.length > 0 ? stored : [sampleProject()];
      const projects = source.map(ensureFeatureLength).sort((a, b) => b.updatedAt - a.updatedAt);
      const changed = projects.filter((project) => {
        const before = stored.find((item) => item.id === project.id);
        return !before || before.targetMinutes < 70;
      });
      await Promise.all(changed.map((project) => saveProject(project)));
      set({ projects, ready: true });
    } catch {
      set({ projects: [sampleProject()], ready: true, notice: "The vault could not be read. Working in this tab only." });
    }
  },
  setAiAvailable: (value) => set({ aiAvailable: value }),
  setSection: (section) => set({ section }),
  setNotice: (notice) => set({ notice }),
  createProject: (project) => {
    set((state) => ({ projects: [project, ...state.projects] }));
    void saveProject(project);
  },
  ensureSample: () => {
    if (get().projects.some((project) => project.id === SAMPLE_ID)) {
      set({ notice: "The sample picture is already in the vault." });
      return;
    }
    const sample = sampleProject();
    set((state) => ({ projects: [sample, ...state.projects], notice: "Sample picture restored." }));
    void saveProject(sample);
  },
  deleteProject: (id) => {
    set((state) => ({ projects: state.projects.filter((project) => project.id !== id) }));
    void deleteProjectRecord(id);
  },
  importProject: (project) => {
    const next = touch({ ...project, id: uid(), createdAt: Date.now() });
    set((state) => ({ projects: [next, ...state.projects], notice: "Backup added as a new picture." }));
    void saveProject(next);
  },
  updateProject: (id, recipe) => {
    set((state) => ({
      projects: state.projects.map((project) => (project.id === id ? touch(recipe(project)) : project)),
    }));
    queueSave(id);
  },
  patchShot: (projectId, shotId, partial) => {
    get().updateProject(projectId, (project) => ({
      ...project,
      shots: project.shots.map((shot) => (shot.id === shotId ? { ...shot, ...partial } : shot)),
    }));
  },
}));

export function blankFrom(input: Parameters<typeof blankProject>[0]): Project {
  return blankProject(input);
}
