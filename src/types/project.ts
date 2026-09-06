import { BrandKit, FaceState } from './product';

export interface StyleBoard {
  id: string;
  createdAt: number;
  dataUrl: string;
  directionName: string;
  prompt: string;
  instruction?: string;
  parentBoardId?: string;
}

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
  verification: KeyVerification;
}
