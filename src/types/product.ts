import { RectMM } from './geometry';

export interface TextField extends RectMM {
  id: string;
  label: string;
  role: 'heading' | 'body';
  sizePt: number;
  align: 'left' | 'center' | 'right';
  leading: number;
  multiline?: boolean;
  ruledLines?: number;
  color?: 'ink' | 'primary' | 'secondary' | 'muted';
  placeholder?: string;
  copyPlaceholders?: string[];
  maxChars?: number;
}

export interface Face {
  id: string;
  label: string;
  artBrief: string;
  textFields: TextField[];
  logoSlot?: RectMM & { onDark?: boolean };
  clearZone?: RectMM;
  allowLettering?: boolean;
}

export interface ProductSpec {
  id: string;
  name: string;
  qty: number;
  trimW: number;
  trimH: number;
  bleed: 3;
  safe: 5;
  faces: Face[];
  copyLabels?: string[];
}

export interface BrandKit {
  coachName: string;
  programName: string;
  logoDataUrl?: string;
  logoTone?: 'light' | 'dark' | 'mixed';
  logoBackdrop?: 'light' | 'dark';
  colors: {
    primary: string;
    secondary: string;
    ink: string;
    paper: string;
    muted: string;
  };
  fonts: {
    heading: string;
    body: string;
  };
  styleNote: string;
  references: string[];
}

export interface ArtworkVariation {
  id: string;
  createdAt: number;
  dataUrl: string;
  resolution: '1K' | '2K' | '4K';
  aspectRatio: string;
  promptSnippet?: string;
  directionName?: string;
  instruction?: string; // For revisions
  parentVariationId?: string;
}

export interface FaceState {
  variations: ArtworkVariation[];
  selectedId?: string;
  finalised?: string; // variation id that was finalized to 4K
  finalDataUrl?: string; // 4K resolution image dataUrl
  copies: Record<number, Record<string, string>>; // copyIndex -> textFieldId -> custom value
  customLayout?: {
    textFields?: Record<string, RectMM>;
    logoSlot?: RectMM;
  };
}
