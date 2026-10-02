# KitForge Test Plan

## Run the suite

From the `kitforge` directory, run:

```sh
npm test
```

The command runs Node's built-in test runner against `src/test/*.test.mjs`.
The suite currently contains 17 automated tests. All should pass; the Gemini
Interactions contract test uses a mocked `fetch` and does not call Google's API.

## Test inventory

### Copy resolution — `src/test/copyResolution.test.mjs`

1. **Per-copy placeholders and overrides** — resolves the four month-specific
   tracker titles and voucher codes, uses a manually entered value in preference
   to a placeholder, and preserves an explicitly blank value instead of
   restoring default copy.

### Layout — `src/test/customLayout.test.mjs`

2. **Custom element layout and PDF coordinates** — confirms a custom text-field
   rectangle overrides its product default and that its coordinates, width,
   and height are converted to PDF points with bleed accounted for.

### Geometry — `src/test/geometry.test.mjs`

3. **Millimeters to PDF points** — checks standard conversions at 25.4 mm and
   127 mm.
4. **Millimeters to pixels** — checks 300-DPI conversions at 25.4 mm and
   229 mm.
5. **Nearest aspect-ratio bucket** — checks square, portrait, landscape,
   ultra-wide, and vertical formats; near-tie portrait and landscape inputs
   allow either of their two closest buckets.
6. **Clear-region percentages** — confirms the clear-zone bounds and margin
   calculated with bleed stay within valid page percentages.

### Text layout — `src/test/textLayout.test.mjs`

7. **Greedy paragraph wrapping** — wraps a paragraph into lines that fit the
   specified width without overflow.
8. **Long unbreakable token wrapping** — breaks a URL-like token character by
   character so every line fits its box.
9. **Shrink-to-fit** — reduces font size when the box is tight, but never below
   75% of the requested size.
10. **Overflow at the shrink floor** — reports overflow when content still
    cannot fit at 75%, rather than silently hiding it.

### PDF text safety — `src/test/textSafety.test.mjs`

11. **Currency substitution** — replaces rupee and euro symbols with safe text
    and reports both substitutions.
12. **Typography punctuation substitution** — replaces curly quotes, typographic
    dashes, and ellipsis with supported ASCII punctuation.
13. **Trademark and special-symbol substitution** — replaces trademark,
    registered, bullet, and copyright symbols with supported equivalents.

### Gemini text API — `src/test/geminiText.test.mjs`

14. **Interactions API request contract** — with network fetch mocked, verifies
    the official SDK sends `gemini-3.8-flash` to the Interactions endpoint,
    authenticates with the API-key header, sets `store: false`, requests JSON
    text output, and returns the response's `output_text`.

### Gemini text models — `src/test/geminiModels.test.mjs`

15. **Free-tier model options and settings fallback** — verifies the default
   and selectable free-tier model IDs, preserves a supported saved selection,
   and falls back to the default for old or unknown settings.

### Gemini error handling — `src/test/geminiErrors.test.mjs`

16. **Temporary capacity error classification** — identifies high-demand and
   unavailable responses without labeling billing errors as temporary capacity.
17. **Model ID in surfaced errors** — prefixes text and image errors with the
   model ID and avoids duplicate prefixes.

## Coverage limits

These tests cover deterministic utility behavior and the SDK request contract.
They do not make live Gemini calls or replace browser-level checks of the
Thank You Letter workflow, approval gates, reference-image handling, canvas
rendering, or PDF download.