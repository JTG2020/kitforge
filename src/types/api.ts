export interface InlineDataPart {
  inlineData: {
    mimeType: string;
    data: string; // base64 string
  };
}

export interface TextPart {
  text: string;
}

export type GeminiPart = InlineDataPart | TextPart;

export interface GeminiGenerateContentRequest {
  contents: Array<{
    parts: GeminiPart[];
  }>;
  generationConfig?: {
    imageConfig?: {
      aspectRatio?: string;
      imageSize?: '1K' | '2K' | '4K';
    };
  };
}

export interface GeminiCandidate {
  content?: {
    parts?: Array<{
      text?: string;
      inlineData?: {
        mimeType: string;
        data: string;
      };
    }>;
  };
  finishReason?: string;
}

export interface GeminiGenerateContentResponse {
  candidates?: GeminiCandidate[];
  error?: {
    code: number;
    message: string;
    status: string;
    details?: Array<{
      '@type': string;
      reason?: string;
      domain?: string;
      metadata?: Record<string, string>;
      links?: Array<{ description: string; url: string }>;
    }>;
  };
}

export interface GeminiModelInfo {
  name: string;
  version?: string;
  displayName?: string;
  description?: string;
  supportedGenerationMethods?: string[];
}

export interface GeminiListModelsResponse {
  models?: GeminiModelInfo[];
  error?: {
    code: number;
    message: string;
    status: string;
  };
}

export interface ParsedApiError {
  httpStatus?: number;
  statusString?: string;
  userMessage: string;
  actionableFix: string;
  activationUrl?: string;
  rawMessage: string;
}
