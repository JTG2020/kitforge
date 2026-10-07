export const META_MUSE_IMAGE_MODEL = 'muse-image-1.0';

const META_IMAGE_API_BASE = 'https://api.meta.ai/v1/images';
const META_MODELS_API = 'https://api.meta.ai/v1/models';

interface MetaMuseImageResponse {
  data?: Array<{ b64_json?: string }>;
  error?: { message?: string };
}

interface MetaMuseModelsResponse {
  data?: Array<{ id?: string }>;
  error?: { message?: string };
}

export async function validateMetaMuseApiKey(apiKey: string): Promise<string> {
  const cleanKey = apiKey.trim();
  if (!cleanKey) throw new Error('Enter a Meta API key first.');

  let response: Response;
  try {
    response = await fetch(META_MODELS_API, {
      method: 'GET',
      headers: { Authorization: `Bearer ${cleanKey}` },
      credentials: 'omit',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Network request failed.';
    throw new Error(`Could not reach Meta Model API: ${message}`, { cause: error });
  }

  let result: MetaMuseModelsResponse;
  try {
    result = await response.json() as MetaMuseModelsResponse;
  } catch {
    throw new Error(`Meta Model API returned an unreadable response (HTTP ${response.status}).`);
  }

  if (!response.ok || result.error) {
    throw new Error(result.error?.message || `Meta API key check failed (HTTP ${response.status}).`);
  }

  if (!result.data?.some((model) => model.id === META_MUSE_IMAGE_MODEL)) {
    throw new Error(`The key is valid, but ${META_MUSE_IMAGE_MODEL} is not available to this account.`);
  }

  return `Meta API key is valid and ${META_MUSE_IMAGE_MODEL} is available.`;
}

async function callMetaMuseImage(
  apiKey: string,
  prompt: string,
  referenceImages: string[],
  size?: string
): Promise<string> {
  const cleanKey = apiKey.trim();
  if (!cleanKey) throw new Error('Muse Image: No Meta API key set in Settings.');
  if (!prompt.trim()) throw new Error('Muse Image: Add an instruction before generating an image.');

  const hasReferences = referenceImages.length > 0;
  const endpoint = `${META_IMAGE_API_BASE}/${hasReferences ? 'edits' : 'generations'}`;
  const payload = {
    model: META_MUSE_IMAGE_MODEL,
    prompt,
    n: 1,
    response_format: 'b64_json',
    output_format: 'png',
    ...(size ? { size } : {}),
    ...(hasReferences
      ? { images: referenceImages.map((imageUrl) => ({ image_url: imageUrl })) }
      : {}),
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cleanKey}`,
      'Content-Type': 'application/json',
    },
    credentials: 'omit',
    body: JSON.stringify(payload),
  });

  let result: MetaMuseImageResponse;
  try {
    result = await response.json() as MetaMuseImageResponse;
  } catch {
    throw new Error(`Muse Image: The image service returned an unreadable response (HTTP ${response.status}).`);
  }

  if (!response.ok || result.error) {
    throw new Error(`Muse Image: ${result.error?.message || `Image request failed (HTTP ${response.status}).`}`);
  }

  const imageData = result.data?.[0]?.b64_json;
  if (!imageData) throw new Error('Muse Image: No image data was returned.');
  return `data:image/png;base64,${imageData}`;
}

export function generateMetaMuseImage(
  apiKey: string,
  prompt: string,
  referenceImages: string[] = [],
  size?: string
): Promise<string> {
  return callMetaMuseImage(apiKey, prompt, referenceImages, size);
}

export function editMetaMuseImage(
  apiKey: string,
  sourceImageDataUrl: string,
  instruction: string,
  size?: string
): Promise<string> {
  if (!sourceImageDataUrl.startsWith('data:image/')) {
    throw new Error('Muse Image: The selected Thank You background is not a supported image.');
  }
  return callMetaMuseImage(apiKey, instruction, [sourceImageDataUrl], size);
}