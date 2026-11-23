import type { Project } from "@/lib/studio/types";

const DB_NAME = "vaeron-ai";
const STORE = "projects";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open the vault"));
  });
}

export async function loadProjects(): Promise<Project[]> {
  if (typeof indexedDB === "undefined") return [];
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
    request.onsuccess = () => resolve((request.result as Project[]) ?? []);
    request.onerror = () => reject(request.error ?? new Error("Could not read projects"));
  });
}

export async function saveProject(project: Project): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(STORE, "readwrite").objectStore(STORE).put(project);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error("Could not save"));
  });
}

export async function deleteProjectRecord(id: string): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(STORE, "readwrite").objectStore(STORE).delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error("Could not delete"));
  });
}
