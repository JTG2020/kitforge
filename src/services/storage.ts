import { ProjectState } from '../types/project';
import { SettingsState } from '../types/project';
import { DEFAULT_GEMINI_TEXT_MODEL, resolveGeminiTextModel } from '../config/textModels';

const DB_NAME = 'kitforge_pixels_v1';
const STORE_NAME = 'images';
const PROJECTS_KEY = 'kitforge_projects_metadata_v1';
const ACTIVE_PROJECT_KEY = 'kitforge_active_project_id_v1';
const SETTINGS_KEY = 'kitforge_user_settings_v1';

let dbPromise: Promise<IDBDatabase> | null = null;

function getDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

export async function saveImageData(id: string, dataUrl: string): Promise<void> {
  if (!id || !dataUrl) return;
  try {
    const db = await getDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(dataUrl, id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Failed to save image to IndexedDB', id, err);
  }
}

export async function getImageData(id: string): Promise<string | null> {
  if (!id) return null;
  try {
    const db = await getDb();
    return await new Promise<string | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Failed to get image from IndexedDB', id, err);
    return null;
  }
}

export async function deleteImageData(id: string): Promise<void> {
  if (!id) return;
  try {
    const db = await getDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Failed to delete image from IndexedDB', id, err);
  }
}

/**
 * Strips all heavy dataUrl strings from a ProjectState before storing in localStorage,
 * and saves images to IndexedDB.
 */
export async function persistProject(project: ProjectState): Promise<void> {
  const imagesToSave: Array<{ id: string; dataUrl: string }> = [];

  // Clone project
  const projectClean: ProjectState = JSON.parse(JSON.stringify(project));

  // BrandKit Logo
  if (project.brandKit.logoDataUrl) {
    const logoId = `logo_${project.id}`;
    imagesToSave.push({ id: logoId, dataUrl: project.brandKit.logoDataUrl });
    projectClean.brandKit.logoDataUrl = logoId; // reference ID
  }

  // BrandKit References
  if (project.brandKit.references) {
    projectClean.brandKit.references = project.brandKit.references.map((ref, idx) => {
      if (ref.startsWith('data:')) {
        const refId = `ref_${project.id}_${idx}`;
        imagesToSave.push({ id: refId, dataUrl: ref });
        return refId;
      }
      return ref;
    });
  }

  const letterReference = project.thankYouLetterIntake?.referenceImageDataUrl;
  if (letterReference?.startsWith('data:')) {
    const referenceId = `thank_you_reference_${project.id}`;
    imagesToSave.push({ id: referenceId, dataUrl: letterReference });
    if (projectClean.thankYouLetterIntake) {
      projectClean.thankYouLetterIntake.referenceImageDataUrl = referenceId;
    }
  }

  // Style Boards
  if (project.styleBoards) {
    for (const sb of project.styleBoards) {
      if (sb.dataUrl && sb.dataUrl.startsWith('data:')) {
        imagesToSave.push({ id: sb.id, dataUrl: sb.dataUrl });
        const cleanSb = projectClean.styleBoards.find((s) => s.id === sb.id);
        if (cleanSb) {
          cleanSb.dataUrl = '';
        }
      }
    }
  }

  // Face Variations & Final Renders
  for (const [faceId, faceState] of Object.entries(project.faceStates || {})) {
    const cleanFace = projectClean.faceStates[faceId];
    if (!cleanFace) continue;

    for (const v of faceState.variations || []) {
      if (v.dataUrl && v.dataUrl.startsWith('data:')) {
        imagesToSave.push({ id: v.id, dataUrl: v.dataUrl });
        const cleanV = cleanFace.variations.find((cv) => cv.id === v.id);
        if (cleanV) {
          cleanV.dataUrl = '';
        }
      }
    }

    if (faceState.finalDataUrl && faceState.finalDataUrl.startsWith('data:')) {
      const finalId = `final_${faceId}_${project.id}`;
      imagesToSave.push({ id: finalId, dataUrl: faceState.finalDataUrl });
      cleanFace.finalDataUrl = finalId;
    }
  }

  // Save all images to IndexedDB in parallel
  await Promise.all(imagesToSave.map((img) => saveImageData(img.id, img.dataUrl)));

  // Save clean metadata to localStorage
  try {
    const stored = localStorage.getItem(PROJECTS_KEY);
    const projectsMap: Record<string, ProjectState> = stored ? JSON.parse(stored) : {};
    projectsMap[project.id] = projectClean;
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(projectsMap));
    localStorage.setItem(ACTIVE_PROJECT_KEY, project.id);
  } catch (err) {
    console.error('Failed to save project metadata to localStorage', err);
  }
}

/**
 * Restores a project from localStorage and hydrates all base64 data URLs from IndexedDB.
 */
export async function loadProjects(): Promise<{
  projects: Record<string, ProjectState>;
  activeId: string | null;
}> {
  try {
    const rawActiveId = localStorage.getItem(ACTIVE_PROJECT_KEY);
    const stored = localStorage.getItem(PROJECTS_KEY);
    if (!stored) {
      return { projects: {}, activeId: null };
    }

    const projectsMap: Record<string, ProjectState> = JSON.parse(stored);
    const hydratedProjects: Record<string, ProjectState> = {};

    for (const [id, project] of Object.entries(projectsMap)) {
      const p: ProjectState = JSON.parse(JSON.stringify(project));

      // Hydrate Logo
      if (p.brandKit.logoDataUrl && !p.brandKit.logoDataUrl.startsWith('data:')) {
        const logoData = await getImageData(p.brandKit.logoDataUrl);
        p.brandKit.logoDataUrl = logoData || undefined;
      }

      // Hydrate References
      if (p.brandKit.references) {
        const hydRefs: string[] = [];
        for (const ref of p.brandKit.references) {
          if (!ref.startsWith('data:')) {
            const data = await getImageData(ref);
            if (data) hydRefs.push(data);
          } else {
            hydRefs.push(ref);
          }
        }
        p.brandKit.references = hydRefs;
      }

      const letterReference = p.thankYouLetterIntake?.referenceImageDataUrl;
      if (letterReference && !letterReference.startsWith('data:')) {
        p.thankYouLetterIntake!.referenceImageDataUrl = await getImageData(letterReference) || undefined;
      }

      // Hydrate Style Boards
      if (p.styleBoards) {
        const validBoards = [];
        for (const sb of p.styleBoards) {
          const imgData = await getImageData(sb.id);
          if (imgData) {
            sb.dataUrl = imgData;
            validBoards.push(sb);
          }
        }
        p.styleBoards = validBoards;

        // Clear invalid chosen or confirmed board IDs if the board is gone
        const boardIds = new Set(validBoards.map((b) => b.id));
        if (p.chosenStyleId && !boardIds.has(p.chosenStyleId)) {
          p.chosenStyleId = undefined;
        }
        if (p.confirmedStyleId && !boardIds.has(p.confirmedStyleId)) {
          p.confirmedStyleId = undefined;
        }
      }

      // Hydrate Face Variations & Final Renders
      for (const faceState of Object.values(p.faceStates || {})) {
        if (faceState.variations) {
          const validVars = [];
          for (const v of faceState.variations) {
            const imgData = await getImageData(v.id);
            if (imgData) {
              v.dataUrl = imgData;
              validVars.push(v);
            }
          }
          faceState.variations = validVars;

          const varIds = new Set(validVars.map((v) => v.id));
          if (faceState.selectedId && !varIds.has(faceState.selectedId)) {
            faceState.selectedId = validVars[0]?.id;
          }
        }

        if (faceState.finalDataUrl && !faceState.finalDataUrl.startsWith('data:')) {
          const finalData = await getImageData(faceState.finalDataUrl);
          faceState.finalDataUrl = finalData || undefined;
        }
      }

      hydratedProjects[id] = p;
    }

    return {
      projects: hydratedProjects,
      activeId: rawActiveId && hydratedProjects[rawActiveId] ? rawActiveId : Object.keys(hydratedProjects)[0] || null,
    };
  } catch (err) {
    console.error('Failed to load projects', err);
    return { projects: {}, activeId: null };
  }
}

/**
 * Loads user settings from localStorage (separate from project data).
 * Seeds with VITE_GEMINI_API_KEY if present in environment, without overriding user-entered key.
 */
export function loadSettings(): SettingsState {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const settings = JSON.parse(raw) as Partial<SettingsState>;
      return {
        ...settings,
        textApiKey: settings.textApiKey || '',
        textModel: resolveGeminiTextModel(settings.textModel),
      } as SettingsState;
    }
  } catch (err) {
    console.error('Failed to read settings from localStorage', err);
  }

  // Check Vite env seed
  const seedKey =
    typeof import.meta !== 'undefined' && (import.meta as any).env
      ? ((import.meta as any).env.VITE_GEMINI_API_KEY as string) || ''
      : '';

  return {
    apiKey: seedKey,
    textApiKey: '',
    textModel: DEFAULT_GEMINI_TEXT_MODEL,
    verification: {
      status: 'unchecked',
      message: 'Not checked yet.',
    },
  };
}

export function saveSettings(settings: SettingsState): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (err) {
    console.error('Failed to save settings to localStorage', err);
  }
}
