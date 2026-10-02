import { BrandKit, FaceState } from './product';
import { GeminiTextModel } from '../config/textModels';

export interface StyleBoard {
  id: string;
  createdAt: number;
  dataUrl: string;
  directionName: string;
  prompt: string;
  instruction?: string;
  parentBoardId?: string;
}

export interface ThankYouLetterIntake {
  category: string;
  categoryOther: string;
  transformation: string;
  feeling: string;
  feelingOverride: string;
  imagery: string;
  setting: string;
  avoid: string;
  logoPlacement: string;
  typography: string;
  accentPhrase: string;
  discussionNotes: string;
  letterText: string;
  referenceImageDataUrl?: string;
}

export const DEFAULT_THANK_YOU_LETTER_INTAKE: ThankYouLetterIntake = {
  category: '',
  categoryOther: '',
  transformation: '',
  feeling: '',
  feelingOverride: '',
  imagery: '',
  setting: '',
  avoid: '',
  logoPlacement: 'Let the design decide',
  typography: 'Classic Editorial Serif',
  accentPhrase: '',
  discussionNotes: '',
  letterText: '',
};

export interface ProjectState {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  brandKit: BrandKit;
  chosenStyleId?: string; // currently selected / inspected thumbnail
  confirmedStyleId?: string; // explicitly confirmed style reference for pieces
  styleBoards: StyleBoard[];
  faceStates: Record<string, FaceState>; // faceId -> FaceState
  thankYouLetterIntake?: ThankYouLetterIntake;
  estimatedCostRupees: number;
}

export type KeyStatus = 'unchecked' | 'valid' | 'amber' | 'invalid';

export interface KeyVerification {
  status: KeyStatus;
  message: string;
  lastTestedAt?: number;
  activationUrl?: string;
  imageModelAvailable?: boolean;
}

export interface SettingsState {
  apiKey: string;
  textApiKey: string;
  textModel: GeminiTextModel;
  verification: KeyVerification;
}
