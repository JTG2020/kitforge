import {
  GeminiGenerateContentRequest,
  GeminiGenerateContentResponse,
  GeminiListModelsResponse,
  GeminiPart,
  ParsedApiError,
} from '../types/api';
import { BrandKit, Face, ProductSpec } from '../types/product';
import { calculateRegionPercentages, findNearestAspectBucket } from '../utils/geometry';
import { MASK_PROMPT_INSTRUCTION } from './mask';
import { DEFAULT_GEMINI_TEXT_MODEL, GeminiTextModel } from '../config/textModels';
import { formatGeminiModelError, isTemporaryGeminiCapacityError } from '../utils/geminiErrors';

export const GEMINI_IMAGE_MODEL = 'gemini-3-pro-image';
export const GEMINI_TEXT_MODEL = DEFAULT_GEMINI_TEXT_MODEL;

function extractMimeAndBase64(dataUrl: string): { mimeType: string; data: string } {
  const parts = dataUrl.split(',');
  const header = parts[0] || '';
  const data = parts[1] || '';
  const match = /data:([^;]+);base64/.exec(header);
  const mimeType = match ? match[1] : 'image/png';
  return { mimeType, data };
}

export function parseApiError(errorObj: any, httpStatus?: number): ParsedApiError {
  const rawMsg = errorObj?.error?.message || errorObj?.message || String(errorObj || '');
  const statusStr = errorObj?.error?.status || (httpStatus ? `HTTP_${httpStatus}` : 'UNKNOWN');
  const details = errorObj?.error?.details || [];

  let activationUrl: string | undefined;
  for (const detail of details) {
    if (detail.links) {
      for (const link of detail.links) {
        if (link.url) {
          activationUrl = link.url;
          break;
        }
      }
    }
  }

  const lower = rawMsg.toLowerCase();

  if (isTemporaryGeminiCapacityError(rawMsg, httpStatus)) {
    return {
      httpStatus,
      statusString: 'UNAVAILABLE',
      userMessage: `${GEMINI_IMAGE_MODEL}: Gemini image generation is temporarily unavailable.`,
      actionableFix: 'Wait a few minutes and try again. This does not indicate an API key or billing problem.',
      activationUrl,
      rawMessage: rawMsg,
    };
  }

  // 1. No key was sent at all
  if (lower.includes('unregistered callers') || lower.includes('api key not provided')) {
    return {
      httpStatus,
      statusString: 'PERMISSION_DENIED',
      userMessage: `${GEMINI_IMAGE_MODEL}: No API key provided or key failed to reach client.`,
      actionableFix: 'The field is empty, or the value never reached the client',
      activationUrl,
      rawMessage: rawMsg,
    };
  }

  // 2. Key string is wrong
  if (httpStatus === 400 || lower.includes('api key not valid') || lower.includes('invalid_argument')) {
    return {
      httpStatus,
      statusString: 'INVALID_ARGUMENT',
      userMessage: `${GEMINI_IMAGE_MODEL}: The API key provided is not valid.`,
      actionableFix: 'Re-copy the key',
      activationUrl,
      rawMessage: rawMsg,
    };
  }

  // 3. Request authenticated as something other than the key
  if (lower.includes('the caller does not have permission') || lower.includes('caller does not have permission')) {
    return {
      httpStatus: 403,
      statusString: 'PERMISSION_DENIED',
      userMessage: `${GEMINI_IMAGE_MODEL}: Permission denied from ambient identity or credentials.`,
      actionableFix:
        'An SDK or a cookie supplied an ambient identity; send the key alone, with credentials: "omit"',
      activationUrl,
      rawMessage: rawMsg,
    };
  }

  // 4. API not enabled
  if (
    lower.includes('service_disabled') ||
    lower.includes('has not been used') ||
    lower.includes('not enabled')
  ) {
    return {
      httpStatus: 403,
      statusString: 'PERMISSION_DENIED',
      userMessage: `${GEMINI_IMAGE_MODEL}: Generative Language API is disabled on this project.`,
      actionableFix: 'Enable the API on that project',
      activationUrl:
        activationUrl || 'https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com',
      rawMessage: rawMsg,
    };
  }

  // 5. Billing required
  if (
    lower.includes('billing') ||
    lower.includes('free tier') ||
    (httpStatus === 403 && lower.includes('permission_denied'))
  ) {
    return {
      httpStatus: 403,
      statusString: 'PERMISSION_DENIED',
      userMessage: `${GEMINI_IMAGE_MODEL}: Project has no billing enabled for image generation.`,
      actionableFix: 'Enable billing — image models have no free tier',
      activationUrl: activationUrl || 'https://aistudio.google.com/api-keys',
      rawMessage: rawMsg,
    };
  }

  // 6. Referrer / restriction
  if (lower.includes('referer') || lower.includes('requests-from')) {
    return {
      httpStatus: 403,
      statusString: 'PERMISSION_DENIED',
      userMessage: `${GEMINI_IMAGE_MODEL}: API Key is restricted by referrer or IP address.`,
      actionableFix: 'Loosen the restriction',
      activationUrl,
      rawMessage: rawMsg,
    };
  }

  // 7. Quota
  if (httpStatus === 429 || lower.includes('resource_exhausted') || lower.includes('quota')) {
    return {
      httpStatus: 429,
      statusString: 'RESOURCE_EXHAUSTED',
      userMessage: `${GEMINI_IMAGE_MODEL}: Rate limit or resource quota exceeded.`,
      actionableFix: 'Wait, or raise the quota',
      activationUrl,
      rawMessage: rawMsg,
    };
  }

  return {
    httpStatus,
    statusString: statusStr,
    userMessage: `${GEMINI_IMAGE_MODEL}: ${rawMsg || 'An unknown error occurred.'}`,
    actionableFix: 'Check key status and project configuration',
    activationUrl,
    rawMessage: rawMsg,
  };
}

/**
 * Validates the key in Stage 1 (free and instant): lists models.
 */
export async function validateApiKeyStage1(apiKey: string): Promise<{
  valid: boolean;
  imageModelAvailable: boolean;
  message: string;
  actionableFix?: string;
  activationUrl?: string;
}> {
  const cleanKey = apiKey.trim();
  if (!cleanKey) {
    return {
      valid: false,
      imageModelAvailable: false,
      message: `${GEMINI_IMAGE_MODEL}: No API key set. Add your image-generation key in Settings.`,
      actionableFix: 'The field is empty, or the value never reached the client',
    };
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(
    cleanKey
  )}&pageSize=200`;

  try {
    const res = await fetch(endpoint, {
      method: 'GET',
      credentials: 'omit',
    });

    const data: GeminiListModelsResponse = await res.json();

    if (!res.ok || data.error) {
      const parsed = parseApiError(data, res.status);
      return {
        valid: false,
        imageModelAvailable: false,
        message: formatGeminiModelError(GEMINI_IMAGE_MODEL, parsed.userMessage),
        actionableFix: parsed.actionableFix,
        activationUrl: parsed.activationUrl,
      };
    }

    const models = data.models || [];
    const hasImageModel = models.some(
      (m) =>
        m.name === `models/${GEMINI_IMAGE_MODEL}` ||
        m.name === GEMINI_IMAGE_MODEL ||
        m.name.includes('gemini-3-pro-image')
    );

    if (!hasImageModel) {
      const availableNames = models
        .map((m) => m.name.replace('models/', ''))
        .filter((n) => n.includes('image') || n.includes('flash') || n.includes('pro'))
        .slice(0, 4)
        .join(', ');

      return {
        valid: true,
        imageModelAvailable: false,
        message: `Key is valid, but '${GEMINI_IMAGE_MODEL}' was not found in available models. (Found: ${availableNames || 'none'})`,
        actionableFix: 'Check your Google Cloud project permissions for Gemini image models',
      };
    }

    return {
      valid: true,
      imageModelAvailable: true,
      message: `Key valid and '${GEMINI_IMAGE_MODEL}' is available.`,
    };
  } catch (err: any) {
    return {
      valid: false,
      imageModelAvailable: false,
      message: formatGeminiModelError(GEMINI_IMAGE_MODEL, err.message || 'Network error connecting to Gemini endpoint.'),
      actionableFix: 'Check your network connection and credentials',
    };
  }
}

/**
 * Validates key in Stage 2 (explicit small 1:1 1K test generation, ~₹6).
 */
export async function validateApiKeyStage2(apiKey: string): Promise<{
  success: boolean;
  message: string;
  actionableFix?: string;
  activationUrl?: string;
}> {
  const cleanKey = apiKey.trim();
  if (!cleanKey) {
    return {
      success: false,
      message: `${GEMINI_IMAGE_MODEL}: No API key set. Add your image-generation key in Settings.`,
      actionableFix: 'The field is empty, or the value never reached the client',
    };
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_IMAGE_MODEL}:generateContent?key=${encodeURIComponent(
    cleanKey
  )}`;

  const body: GeminiGenerateContentRequest = {
    contents: [
      {
        parts: [{ text: 'a plain cream square' }],
      },
    ],
    generationConfig: {
      imageConfig: {
        aspectRatio: '1:1',
        imageSize: '1K',
      },
    },
  };

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'omit',
      body: JSON.stringify(body),
    });

    const data: GeminiGenerateContentResponse = await res.json();

    if (!res.ok || data.error) {
      const parsed = parseApiError(data, res.status);
      return {
        success: false,
        message: formatGeminiModelError(GEMINI_IMAGE_MODEL, parsed.userMessage),
        actionableFix: parsed.actionableFix,
        activationUrl: parsed.activationUrl,
      };
    }

    // Verify candidate
    const candidate = data.candidates?.[0];
    const imgPart = candidate?.content?.parts?.find((p) => p.inlineData);
    if (!imgPart?.inlineData?.data) {
      return {
        success: false,
        message: `${GEMINI_IMAGE_MODEL}: No image data returned from model.`,
        actionableFix: 'Retry with billing enabled key',
      };
    }

    return {
      success: true,
      message: 'Key validated successfully! Test image generation succeeded.',
    };
  } catch (err: any) {
    return {
      success: false,
      message: formatGeminiModelError(GEMINI_IMAGE_MODEL, err.message || 'Network error during test generation.'),
      actionableFix: 'Check connection and project configuration',
    };
  }
}

/**
 * Direct fetch execution to Gemini REST generateContent.
 */
async function callGeminiGenerateContent(
  apiKey: string,
  parts: GeminiPart[],
  aspectRatio: string,
  imageSize: '1K' | '2K' | '4K'
): Promise<string> {
  const cleanKey = apiKey.trim();
  if (!cleanKey) {
    throw new Error(`${GEMINI_IMAGE_MODEL}: No image-generation API key set.`);
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_IMAGE_MODEL}:generateContent?key=${encodeURIComponent(
    cleanKey
  )}`;

  const payload: GeminiGenerateContentRequest = {
    contents: [{ parts }],
    generationConfig: {
      imageConfig: {
        aspectRatio,
        imageSize,
      },
    },
  };

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'omit',
      body: JSON.stringify(payload),
    });

    const data: GeminiGenerateContentResponse = await res.json();

    if (!res.ok || data.error) {
      const parsed = parseApiError(data, res.status);
      const err = new Error(`${parsed.userMessage} (${parsed.actionableFix})`);
      (err as any).parsed = parsed;
      throw err;
    }

    const candidate = data.candidates?.[0];
    const inline = candidate?.content?.parts?.find((p) => p.inlineData);
    if (!inline || !inline.inlineData?.data) {
      throw new Error('No image was returned in the model candidate parts.');
    }

    const { mimeType, data: b64 } = inline.inlineData;
    return `data:${mimeType};base64,${b64}`;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const wrappedError = new Error(formatGeminiModelError(GEMINI_IMAGE_MODEL, message), { cause: error });
    if ((error as any)?.parsed) (wrappedError as any).parsed = (error as any).parsed;
    throw wrappedError;
  }
}

export async function generateGeminiTextCall(
  apiKey: string,
  prompt: string,
  responseMimeType?: 'application/json',
  model: GeminiTextModel = GEMINI_TEXT_MODEL
): Promise<string> {
  const cleanKey = apiKey.trim();
  if (!cleanKey) throw new Error(`${model}: No text-model API key set in Settings.`);

  try {
    const { GoogleGenAI } = await import('@google/genai');
    const client = new GoogleGenAI({ apiKey: cleanKey });
    const interaction = await client.interactions.create({
      model,
      input: prompt,
      store: false,
      ...(responseMimeType
        ? { response_format: [{ type: 'text' as const, mime_type: responseMimeType }] }
        : {}),
    });

    const text = interaction.output_text?.trim();
    if (!text) throw new Error('The text model returned an empty response.');
    return text;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(formatGeminiModelError(model, message), { cause: error });
  }
}

/**
 * 1. Style Board Generator (1:1, 1K)
 */
export async function generateStyleBoardCall(
  apiKey: string,
  brandKit: BrandKit,
  directionText: string
): Promise<string> {
  const promptText = `Design a style reference board for a print stationery range.

The board is a flat, full-bleed panel divided into a few clean areas
that together show one coherent design language: a sample of the border
treatment, a corner ornament, a repeating motif, a background texture,
and blocks of the palette.

It is a swatch of visual language rather than a finished item, so it
shows HOW things are drawn: line weight, ornament density, the way
colours meet, the character of the shapes.

INK STRENGTH: ornament is drawn in full-strength ink at the deepest
value of the primary colour, reading crisply and darkly against the
paper. Every piece in the range copies this board, so a washed-out
board yields a washed-out kit.

PALETTE:
  primary ${brandKit.colors.primary}  |  accent ${brandKit.colors.secondary}  |  paper ${brandKit.colors.paper}

CLIENT DIRECTION: ${brandKit.styleNote || 'Refined executive stationery with timeless precision.'}

The board is entirely wordless: ornament, colour and texture alone.
Colour is shown as plain blocks of the colour itself. Every letter,
numeral, hex code, label and caption is left out, including any writing
that would name or annotate a swatch.

STYLE: ${directionText}`;

  const parts: GeminiPart[] = [];

  // Optional user reference images (up to 3)
  for (const ref of brandKit.references.slice(0, 3)) {
    if (ref.startsWith('data:')) {
      const { mimeType, data } = extractMimeAndBase64(ref);
      parts.push({ inlineData: { mimeType, data } });
    }
  }

  parts.push({ text: promptText });

  return callGeminiGenerateContent(apiKey, parts, '1:1', '1K');
}

/**
 * 2. Piece Artwork Generator (nearest bucket, 2K draft or 4K final)
 */
export async function generatePieceArtworkCall(
  apiKey: string,
  spec: ProductSpec,
  face: Face,
  brandKit: BrandKit,
  confirmedStyleBoardDataUrl: string,
  layoutMaskDataUrl: string,
  variantHintText: string,
  imageSize: '2K' | '4K' = '2K'
): Promise<string> {
  const nearestBucket = findNearestAspectBucket(spec.trimW + spec.bleed * 2, spec.trimH + spec.bleed * 2);
  const region = calculateRegionPercentages(spec.trimW, spec.trimH, spec.bleed, face.clearZone);

  const faceLabelText = face.label && !face.label.toLowerCase().includes('front') ? `, ${face.label}` : '';

  const logoFieldText =
    brandKit.logoTone === 'light'
      ? 'a deep, saturated field in the primary colour, even in tone and free of detail, so that a pale brand mark placed on it afterwards stands out clearly.'
      : 'the centre of the open region is a clean, pale, evenly-lit surface, free of detail, so that a dark brand mark placed on it afterwards stands out clearly.';

  const isSticker = !!face.allowLettering;

  const surfaceAndWordlessParagraphs = isSticker
    ? ''
    : `SURFACE: the open region is one smooth, continuous surface - flat
tint, soft paper texture or a very faint watermark motif. It reads as
blank stationery waiting to be printed on, so it stays free of ruling,
grids, columns, boxes and tick marks; those are added later in press.

The panel is entirely wordless: ornament, colour and texture alone.
Every letter, numeral, monogram, initial and word is left out, since
all wording is printed separately on top afterwards.`;

  const promptText = `Design a flat, full-bleed decorative panel, seen straight on.

The panel is a digital artwork file that fills the entire canvas and is
cropped by its four edges, continuing past them the way wallpaper or a
decorative page background does. It sits flush to the frame on all four
sides.

PURPOSE: ${spec.name}${faceLabelText}, part of a printed welcome kit.

${face.artBrief}

PALETTE, used richly:
  primary ${brandKit.colors.primary}  |  accent ${brandKit.colors.secondary}  |  paper ${brandKit.colors.paper}

INK STRENGTH: the ornament is printed in full-strength ink. Every line,
rule and corner device sits at the deepest value of the primary colour,
at full opacity, reading crisply and darkly against the paper. The
corners in particular carry the strongest, most defined detail on the
panel, drawn at the same weight as the rest of the border. Any wash,
fade or texture stays behind the linework and never lightens it.

CLIENT DIRECTION: ${brandKit.styleNote || 'Refined executive stationery with timeless precision.'}

ORNAMENT BUDGET: the decoration lives entirely within the outer ${region.margin}% of
the canvas, forming a slim band that runs around all four edges. It reads as a
fine frame hugging the border.

OPEN REGION: everything from ${region.left}% to ${region.right}% across and ${region.top}% to
${region.bottom}% down is the printing area. It stays pale and low contrast
throughout - a soft tint or a barely-there watermark - so that dark
printed text laid over it reads cleanly. The frame stops at the boundary
of this region on every side, corners included, leaving it open.

LOGO FIELD: ${logoFieldText}

${surfaceAndWordlessParagraphs}

STYLE: ${variantHintText}`;

  // Sequence: [References] + [Relationship] + [Scenario]
  const parts: GeminiPart[] = [];

  // 1. Confirmed style board image
  if (confirmedStyleBoardDataUrl) {
    const { mimeType, data } = extractMimeAndBase64(confirmedStyleBoardDataUrl);
    parts.push({ inlineData: { mimeType, data } });
  }

  // 2. Layout mask image
  if (layoutMaskDataUrl) {
    const { mimeType, data } = extractMimeAndBase64(layoutMaskDataUrl);
    parts.push({ inlineData: { mimeType, data } });
    parts.push({ text: MASK_PROMPT_INSTRUCTION });
  }

  // 3. User brand references
  for (const ref of brandKit.references.slice(0, 2)) {
    if (ref.startsWith('data:')) {
      const { mimeType, data } = extractMimeAndBase64(ref);
      parts.push({ inlineData: { mimeType, data } });
    }
  }

  // 4. Main prompt
  parts.push({ text: promptText });

  return callGeminiGenerateContent(apiKey, parts, nearestBucket, imageSize);
}

export async function generateThankYouBackgroundCall(
  apiKey: string,
  spec: ProductSpec,
  brandKit: BrandKit,
  approvedBrief: string,
  referenceImages: string[]
): Promise<string> {
  const aspectRatio = findNearestAspectBucket(
    spec.trimW + spec.bleed * 2,
    spec.trimH + spec.bleed * 2
  );
  const parts: GeminiPart[] = [];

  for (const reference of referenceImages.slice(0, 3)) {
    if (reference.startsWith('data:')) {
      const { mimeType, data } = extractMimeAndBase64(reference);
      parts.push({ inlineData: { mimeType, data } });
    }
  }

  parts.push({
    text: `Create a full-bleed photographic or pictorial background for ${spec.name}, a print-ready thank-you letter.\n\nAPPROVED CREATIVE BRIEF: ${approvedBrief}\n\nUse this brand palette naturally: primary ${brandKit.colors.primary}, accent ${brandKit.colors.secondary}, paper ${brandKit.colors.paper}. Brand direction: ${brandKit.styleNote || 'warm, thoughtful, and refined'}.\n\nThe output is background artwork only. Do not render any words, letters, numbers, logo, signature, borders, card mockup, paper edges, or desk. Keep the letter's central copy area calm, light, and low-contrast for editable vector text; allow richer photographic detail toward the edges. Produce a flat, straight-on image that fills the canvas and extends to all edges. If reference images are attached, use them as visual guidance but do not reproduce their text or logos.`,
  });

  return callGeminiGenerateContent(apiKey, parts, aspectRatio, '2K');
}

/**
 * 4. Revision Generator
 */
export async function generateRevisionCall(
  apiKey: string,
  existingImageDataUrl: string,
  changeInstruction: string,
  aspectRatio: string,
  imageSize: '1K' | '2K' | '4K' = '2K'
): Promise<string> {
  const promptText = `Revise the attached design.

CHANGE: ${changeInstruction}

Everything else stays as it is: the same composition, the same layout,
the same areas left open, the same overall character. Apply only the
change described above.

The panel remains flat, full-bleed and entirely wordless.`;

  const { mimeType, data } = extractMimeAndBase64(existingImageDataUrl);

  const parts: GeminiPart[] = [
    { inlineData: { mimeType, data } },
    { text: promptText },
  ];

  return callGeminiGenerateContent(apiKey, parts, aspectRatio, imageSize);
}
