import test from 'node:test';
import assert from 'node:assert/strict';
import { GoogleGenAI } from '@google/genai';

test('Google GenAI SDK calls Gemini 3.8 Flash via Interactions without storing input', async () => {
  const originalFetch = globalThis.fetch;
  let requestUrl;
  let requestBody;
  let requestHeaders;

  globalThis.fetch = async (input, init = {}) => {
    const request = input instanceof Request ? input : new Request(input, init);
    requestUrl = new URL(request.url);
    requestBody = await request.clone().json();
    requestHeaders = request.headers;
    return new Response(
      JSON.stringify({
        id: 'interaction_test',
        status: 'completed',
        model: 'gemini-3.8-flash',
        output_text: '{"category":"Leadership"}',
        steps: [
          {
            type: 'model_output',
            status: 'done',
            content: [{ type: 'text', text: '{"category":"Leadership"}' }],
          },
        ],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  };

  try {
    const client = new GoogleGenAI({ apiKey: 'test-key' });
    const response = await client.interactions.create({
      model: 'gemini-3.8-flash',
      input: 'Extract category',
      store: false,
      response_format: [{ type: 'text', mime_type: 'application/json' }],
    });

    assert.equal(response.output_text, '{"category":"Leadership"}');
    assert.equal(requestUrl.pathname, '/v1beta/interactions');
    assert.equal(requestHeaders.get('x-goog-api-key'), 'test-key');
    assert.equal(requestBody.model, 'gemini-3.8-flash');
    assert.equal(requestBody.input, 'Extract category');
    assert.equal(requestBody.store, false);
    assert.deepEqual(requestBody.response_format, [{ type: 'text', mime_type: 'application/json' }]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});