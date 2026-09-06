import { useState, useEffect, useRef, useCallback } from 'react';
import { BrandKit, FaceState, ArtworkVariation } from '../types/product';
import { ProjectState, SettingsState, StyleBoard } from '../types/project';
import { DEFAULT_PRODUCT_SPECS } from '../config/products';
import { getDefaultPalette } from '../services/palette';
import { loadProjects, loadSettings, persistProject, saveSettings } from '../services/storage';

export function createDefaultFaceStates(): Record<string, FaceState> {
  const faceStates: Record<string, FaceState> = {};
  for (const spec of DEFAULT_PRODUCT_SPECS) {
    for (const face of spec.faces) {
      faceStates[face.id] = {
        variations: [],
        copies: {},
      };
    }
  }
  return faceStates;
}

export function createDefaultBrandKit(): BrandKit {
  const defaultPalette = getDefaultPalette('dark');
  return {
    coachName: 'Aria Sterling',
    programName: 'Executive Mastery Container',
    colors: {
      primary: defaultPalette.primary,
      secondary: defaultPalette.secondary,
      ink: defaultPalette.ink,
      paper: defaultPalette.paper,
      muted: defaultPalette.muted,
    },
    fonts: {
      heading: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif',
      body: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    },
    styleNote: 'Restrained architectural elegance with deep teal and warm copper accents.',
    references: [],
  };
}

export function createInitialProject(name = 'Welcome Kit 2026'): ProjectState {
  return {
    id: `proj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    brandKit: createDefaultBrandKit(),
    styleBoards: [],
    faceStates: createDefaultFaceStates(),
    estimatedCostRupees: 0,
  };
}

export function useKitForgeStore() {
  const [projects, setProjects] = useState<Record<string, ProjectState>>({});
  const [activeProjectId, setActiveProjectId] = useState<string>('');
  const [settings, setSettings] = useState<SettingsState>(loadSettings);
  const [isHydrated, setIsHydrated] = useState(false);

  const isInitialMount = useRef(true);

  // 1. Initial hydration from IndexedDB and localStorage
  useEffect(() => {
    async function hydrate() {
      const loaded = await loadProjects();
      const loadedSettings = loadSettings();
      setSettings(loadedSettings);

      if (Object.keys(loaded.projects).length > 0) {
        setProjects(loaded.projects);
        setActiveProjectId(loaded.activeId || Object.keys(loaded.projects)[0]);
      } else {
        const defaultProj = createInitialProject('Executive Coaching Kit');
        setProjects({ [defaultProj.id]: defaultProj });
        setActiveProjectId(defaultProj.id);
        await persistProject(defaultProj);
      }
      setIsHydrated(true);
    }
    hydrate();
  }, []);

  // Current active project
  const currentProject = projects[activeProjectId] || Object.values(projects)[0] || createInitialProject();

  // 2. Reactive save on project or settings changes (only after hydration!)
  useEffect(() => {
    if (!isHydrated) return;
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    if (currentProject) {
      persistProject(currentProject);
    }
  }, [currentProject, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    saveSettings(settings);
  }, [settings, isHydrated]);

  // Project manipulation callbacks
  const createNewProject = useCallback((name = 'New Stationery Kit') => {
    const newProj = createInitialProject(name);
    setProjects((prev) => ({ ...prev, [newProj.id]: newProj }));
    setActiveProjectId(newProj.id);
  }, []);

  const duplicateProject = useCallback((sourceId: string) => {
    setProjects((prev) => {
      const source = prev[sourceId];
      if (!source) return prev;
      const copy: ProjectState = JSON.parse(JSON.stringify(source));
      copy.id = `proj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      copy.name = `${source.name} (Copy)`;
      copy.createdAt = Date.now();
      copy.updatedAt = Date.now();
      return { ...prev, [copy.id]: copy };
    });
  }, []);

  const updateBrandKit = useCallback((updates: Partial<BrandKit>) => {
    setProjects((prev) => {
      const p = prev[activeProjectId];
      if (!p) return prev;
      return {
        ...prev,
        [activeProjectId]: {
          ...p,
          updatedAt: Date.now(),
          brandKit: { ...p.brandKit, ...updates },
        },
      };
    });
  }, [activeProjectId]);

  const addStyleBoard = useCallback((board: StyleBoard) => {
    setProjects((prev) => {
      const p = prev[activeProjectId];
      if (!p) return prev;
      const updatedBoards = [board, ...(p.styleBoards || [])];
      return {
        ...prev,
        [activeProjectId]: {
          ...p,
          updatedAt: Date.now(),
          styleBoards: updatedBoards,
          chosenStyleId: p.chosenStyleId || board.id,
        },
      };
    });
  }, [activeProjectId]);

  const setChosenStyleId = useCallback((id?: string) => {
    setProjects((prev) => {
      const p = prev[activeProjectId];
      if (!p) return prev;
      return {
        ...prev,
        [activeProjectId]: {
          ...p,
          updatedAt: Date.now(),
          chosenStyleId: id,
        },
      };
    });
  }, [activeProjectId]);

  const setConfirmedStyleId = useCallback((id?: string) => {
    setProjects((prev) => {
      const p = prev[activeProjectId];
      if (!p) return prev;
      return {
        ...prev,
        [activeProjectId]: {
          ...p,
          updatedAt: Date.now(),
          confirmedStyleId: id,
        },
      };
    });
  }, [activeProjectId]);

  const updateFaceState = useCallback((faceId: string, updates: Partial<FaceState>) => {
    setProjects((prev) => {
      const p = prev[activeProjectId];
      if (!p) return prev;
      const currentFace = p.faceStates[faceId] || { variations: [], copies: {} };
      return {
        ...prev,
        [activeProjectId]: {
          ...p,
          updatedAt: Date.now(),
          faceStates: {
            ...p.faceStates,
            [faceId]: { ...currentFace, ...updates },
          },
        },
      };
    });
  }, [activeProjectId]);

  const addArtworkVariation = useCallback((faceId: string, variation: ArtworkVariation) => {
    setProjects((prev) => {
      const p = prev[activeProjectId];
      if (!p) return prev;
      const currentFace = p.faceStates[faceId] || { variations: [], copies: {} };
      const variations = [variation, ...currentFace.variations];
      const selectedId = currentFace.selectedId || variation.id;
      return {
        ...prev,
        [activeProjectId]: {
          ...p,
          updatedAt: Date.now(),
          faceStates: {
            ...p.faceStates,
            [faceId]: {
              ...currentFace,
              variations,
              selectedId,
            },
          },
        },
      };
    });
  }, [activeProjectId]);

  const setFaceSelectedId = useCallback((faceId: string, variationId: string) => {
    setProjects((prev) => {
      const p = prev[activeProjectId];
      if (!p) return prev;
      const currentFace = p.faceStates[faceId] || { variations: [], copies: {} };
      return {
        ...prev,
        [activeProjectId]: {
          ...p,
          updatedAt: Date.now(),
          faceStates: {
            ...p.faceStates,
            [faceId]: { ...currentFace, selectedId: variationId },
          },
        },
      };
    });
  }, [activeProjectId]);

  const setFaceFinalData = useCallback((faceId: string, variationId: string, finalDataUrl: string) => {
    setProjects((prev) => {
      const p = prev[activeProjectId];
      if (!p) return prev;
      const currentFace = p.faceStates[faceId] || { variations: [], copies: {} };
      return {
        ...prev,
        [activeProjectId]: {
          ...p,
          updatedAt: Date.now(),
          faceStates: {
            ...p.faceStates,
            [faceId]: {
              ...currentFace,
              finalised: variationId,
              finalDataUrl,
            },
          },
        },
      };
    });
  }, [activeProjectId]);

  const updateCopyValue = useCallback((faceId: string, copyIndex: number, fieldId: string, value: string) => {
    setProjects((prev) => {
      const p = prev[activeProjectId];
      if (!p) return prev;
      const currentFace = p.faceStates[faceId] || { variations: [], copies: {} };
      const currentCopies = { ...(currentFace.copies || {}) };
      const copyRecord = { ...(currentCopies[copyIndex] || {}) };
      copyRecord[fieldId] = value;
      currentCopies[copyIndex] = copyRecord;

      return {
        ...prev,
        [activeProjectId]: {
          ...p,
          updatedAt: Date.now(),
          faceStates: {
            ...p.faceStates,
            [faceId]: { ...currentFace, copies: currentCopies },
          },
        },
      };
    });
  }, [activeProjectId]);

  const updateElementRect = useCallback(
    (faceId: string, elementId: string, rect: import('../types/geometry').RectMM) => {
      setProjects((prev) => {
        const p = prev[activeProjectId];
        if (!p) return prev;
        const currentFace = p.faceStates[faceId] || { variations: [], copies: {} };
        const currentCustom = currentFace.customLayout || {};

        let newCustomLayout: NonNullable<FaceState['customLayout']>;
        if (elementId === 'logo') {
          newCustomLayout = {
            ...currentCustom,
            logoSlot: { ...rect },
          };
        } else {
          newCustomLayout = {
            ...currentCustom,
            textFields: {
              ...(currentCustom.textFields || {}),
              [elementId]: { ...rect },
            },
          };
        }

        return {
          ...prev,
          [activeProjectId]: {
            ...p,
            updatedAt: Date.now(),
            faceStates: {
              ...p.faceStates,
              [faceId]: {
                ...currentFace,
                customLayout: newCustomLayout,
              },
            },
          },
        };
      });
    },
    [activeProjectId]
  );

  const resetCustomLayout = useCallback(
    (faceId: string) => {
      setProjects((prev) => {
        const p = prev[activeProjectId];
        if (!p) return prev;
        const currentFace = p.faceStates[faceId] || { variations: [], copies: {} };
        return {
          ...prev,
          [activeProjectId]: {
            ...p,
            updatedAt: Date.now(),
            faceStates: {
              ...p.faceStates,
              [faceId]: {
                ...currentFace,
                customLayout: undefined,
              },
            },
          },
        };
      });
    },
    [activeProjectId]
  );

  const recordCostRupees = useCallback((rupees: number) => {
    setProjects((prev) => {
      const p = prev[activeProjectId];
      if (!p) return prev;
      return {
        ...prev,
        [activeProjectId]: {
          ...p,
          estimatedCostRupees: (p.estimatedCostRupees || 0) + rupees,
        },
      };
    });
  }, [activeProjectId]);

  const updateSettings = useCallback((updates: Partial<SettingsState>) => {
    setSettings((prev) => ({ ...prev, ...updates }));
  }, []);

  return {
    isHydrated,
    projects,
    activeProjectId,
    currentProject,
    settings,
    setActiveProjectId,
    createNewProject,
    duplicateProject,
    updateBrandKit,
    addStyleBoard,
    setChosenStyleId,
    setConfirmedStyleId,
    updateFaceState,
    addArtworkVariation,
    setFaceSelectedId,
    setFaceFinalData,
    updateCopyValue,
    updateElementRect,
    resetCustomLayout,
    recordCostRupees,
    updateSettings,
  };
}
