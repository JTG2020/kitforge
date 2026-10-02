import test from 'node:test';
import assert from 'node:assert/strict';
import {
  editThankYouBackgroundWithMuse,
  generateThankYouBackgroundWithProvider,
} from '../services/thankYouImage.ts';

const spec = { trimW: 148, trimH: 210, bleed: 3 };

test('Thank You provider dispatch selects Muse or Gemini without changing other callers', async () => {
  const originalFetch = globalThis.fetch;
  const requestUrls = [];

  globalThis.fetch = async (input) => {
    const url = new URL(input);
    requestUrls.push(url);
    if (url.hostname === 'api.meta.ai') {
      return new Response(JSON.stringify({ data: [{ b64_json: 'bXVzZQ==' }] }), { status: 200 });
    }
    return new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: 'Z2VtaW5p' } }] } }],
    }), { status: 200 });
  };

  try {
    let geminiFallbackCalled = false;
    const museResult = await generateThankYouBackgroundWithProvider(
      'meta-muse', 'meta-key', 'Approved Muse prompt', [], spec, async () => {
        geminiFallbackCalled = true;
        return 'unexpected-gemini-result';
      }
    );
    const geminiResult = await generateThankYouBackgroundWithProvider(
      'gemini', 'unused-meta-key', 'Approved Gemini prompt', [], spec, async () => 'gemini-result'
    );

    assert.equal(museResult, 'data:image/png;base64,bXVzZQ==');
    assert.equal(geminiResult, 'gemini-result');
    assert.equal(geminiFallbackCalled, false);
    assert.deepEqual(requestUrls.map((url) => url.hostname), ['api.meta.ai']);
    assert.equal(requestUrls[0].pathname, '/v1/images/generations');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Thank You Muse edits send the selected image, preserve copy space, and match its page ratio', async () => {
  const originalFetch = globalThis.fetch;
  let requestBody;

  globalThis.fetch = async (_input, init) => {
    requestBody = JSON.parse(init.body);
    return new Response(JSON.stringify({ data: [{ b64_json: 'ZWRpdA==' }] }), { status: 200 });
  };

  try {
    const source = 'data:image/png;base64,c291cmNl';
    const result = await editThankYouBackgroundWithMuse('meta-key', source, 'Add soft florals at the edges', spec);

    assert.equal(result, 'data:image/png;base64,ZWRpdA==');
    assert.equal(requestBody.model, 'muse-image-1.0');
    assert.equal(requestBody.size, '1095x1536');
    assert.equal(requestBody.prompt.startsWith('Add soft florals at the edges'), true);
    assert.match(requestBody.prompt, /low-contrast central copy area/);
    assert.deepEqual(requestBody.images, [{ image_url: source }]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});