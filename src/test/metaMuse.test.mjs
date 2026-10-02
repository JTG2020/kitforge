import test from 'node:test';
import assert from 'node:assert/strict';
import { editMetaMuseImage, generateMetaMuseImage } from '../services/metaMuse.ts';

function mockImageResponse(b64 = 'aW1hZ2U=') {
  return new Response(JSON.stringify({ data: [{ b64_json: b64 }] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

test('Muse prompt-only generation uses the Images API and returns a PNG data URL', async () => {
  const originalFetch = globalThis.fetch;
  let requestUrl;
  let requestOptions;

  globalThis.fetch = async (input, init) => {
    requestUrl = new URL(input);
    requestOptions = init;
    return mockImageResponse();
  };

  try {
    const result = await generateMetaMuseImage(' meta-test-key ', 'A calm, bright background');
    const requestBody = JSON.parse(requestOptions.body);

    assert.equal(result, 'data:image/png;base64,aW1hZ2U=');
    assert.equal(requestUrl.href, 'https://api.meta.ai/v1/images/generations');
    assert.equal(requestOptions.headers.Authorization, 'Bearer meta-test-key');
    assert.equal(requestOptions.credentials, 'omit');
    assert.equal(requestBody.model, 'muse-image-1.0');
    assert.equal(requestBody.prompt, 'A calm, bright background');
    assert.equal(requestBody.response_format, 'b64_json');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Muse uses the edits endpoint for reference images and prompt-guided edits', async () => {
  const originalFetch = globalThis.fetch;
  let requestUrl;
  let requestBody;

  globalThis.fetch = async (input, init) => {
    requestUrl = new URL(input);
    requestBody = JSON.parse(init.body);
    return mockImageResponse('ZWRpdGVk');
  };

  try {
    const reference = 'data:image/png;base64,c291cmNl';
    const generated = await generateMetaMuseImage('meta-test-key', 'Use this as visual guidance', [reference]);
    assert.equal(requestUrl.pathname, '/v1/images/edits');
    assert.deepEqual(requestBody.images, [{ image_url: reference }]);
    assert.equal(generated, 'data:image/png;base64,ZWRpdGVk');

    const edited = await editMetaMuseImage('meta-test-key', reference, 'Make the edges more vivid');
    assert.equal(requestUrl.pathname, '/v1/images/edits');
    assert.equal(requestBody.prompt, 'Make the edges more vivid');
    assert.deepEqual(requestBody.images, [{ image_url: reference }]);
    assert.equal(edited, 'data:image/png;base64,ZWRpdGVk');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Muse reports API errors and rejects missing image data', async () => {
  const originalFetch = globalThis.fetch;

  try {
    globalThis.fetch = async () => new Response(JSON.stringify({ error: { message: 'Invalid API key' } }), { status: 401 });
    await assert.rejects(generateMetaMuseImage('meta-test-key', 'A background'), /Muse Image: Invalid API key/);

    globalThis.fetch = async () => new Response(JSON.stringify({ data: [] }), { status: 200 });
    await assert.rejects(generateMetaMuseImage('meta-test-key', 'A background'), /No image data was returned/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Muse rejects missing credentials, blank instructions, and non-image edit sources', async () => {
  await assert.rejects(generateMetaMuseImage('', 'A background'), /No Meta API key/);
  await assert.rejects(generateMetaMuseImage('meta-test-key', '  '), /Add an instruction/);
  assert.throws(() => editMetaMuseImage('meta-test-key', 'not-an-image', 'Change the background'), /not a supported image/);
});