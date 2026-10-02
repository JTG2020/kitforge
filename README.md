# KitForge

KitForge is a browser-based design tool for preparing branded, print-ready coaching welcome-kit materials. It combines brand and layout controls with Gemini-assisted artwork, editable vector text, print checks, and PDF export. The current build runs locally for one operator; it is not a hosted or multi-user service.

## What the app includes

- **Brand:** create and switch projects; set coach and program details, brand colors, a logo, reference images, and a design note.
- **Look:** generate and review style boards using six directions: Ornamental letterpress, Organic botanical, Modern geometric, Art deco, Soft watercolour, and Fine guilloche. Confirm a style before using it for kit-piece artwork.
- **Pieces:** work with the configured welcome-kit designs, enter copy, review generated artwork, and adjust supported text and logo placement. Repeated items support their own copy values.
- **Thank You Letter:** complete a coaching-focused intake, optionally analyze discussion notes to prefill clearly supported answers, provide a reference image, and supply or draft letter wording. Review and approve any AI-proposed wording and the background prompt before image generation. Then adjust the design, explicitly approve it, run the print audit, and export the letter PDF.
- **Export:** inspect the complete configured kit and export its 15-page PDF. The dedicated Thank You Letter workflow also exports that letter on its own.

The configured kit includes a C5 envelope, four monthly trackers, a two-sided goal card, an A5 sticker sheet, a Thank You Letter, an affirmation card, four referral coupons, and an upgrade coupon. Product dimensions, bleed, safe areas, text fields, and quantities are defined in `src/config/products.ts`.

## Technology

- React 19 and TypeScript 5.7, built and served with Vite 6.
- Tailwind CSS 4 for styling.
- `gemini-3-pro-image` for generated artwork. Settings offers these free-tier text models for analysis, copy drafting, and prompt preparation: `gemini-3.8-flash` (default), `gemini-3.7-flash`, `gemini-3.6-flash`, `gemini-3.5-flash`, `gemini-3.5-flash-lite`, `gemini-3.1-flash-lite`, `gemini-3-flash-preview`, `gemini-2.5-flash`, `gemini-2.5-flash-lite`, and `gemini-2.5-pro`.
- `pdf-lib` and `@pdf-lib/fontkit` for PDF output; browser `localStorage` and IndexedDB for local settings, project data, and images.
- Node.js built-in test runner for the automated tests; no backend or database server is required.

## Requirements

- Node.js and npm.
- A modern browser with local storage and IndexedDB enabled.
- Outbound internet access to Google's Gemini API for AI analysis, copy drafting, and artwork generation.
- A billing-enabled Gemini API key for image generation. Image generation is not available on the free tier and may incur provider charges.
- A separate Gemini API key for the selected free-tier text model. Text features never fall back to or send requests with the image-generation key.

## Run locally

From this directory (`kitforge`):

```sh
npm install
npm run dev
```

Vite prints the local address when ready (normally <http://localhost:5173/>). To expose the development server to other devices on the same network, use:

```sh
npm run dev -- --host 0.0.0.0
```

In the app, open **Settings** and enter separate keys for image generation and text models. The text-key check sends a short request through the selected free-tier model. The image-key check can optionally generate a small test image, which may incur a charge. You can seed a local development session's image key with `VITE_GEMINI_API_KEY` in a `.env.local` file, but do not commit that file or expose the development build publicly.

## Typical workflow

1. Create or select a project and fill in the brand details, colors, logo, and any useful references.
2. Generate style boards, choose a direction, and confirm it.
3. Use **Pieces** to prepare artwork and per-item copy, adjusting supported layout elements as needed.
4. For the Thank You Letter, enter intake answers and optional notes, wording, and reference imagery. AI-drafted copy is editable and requires approval. Review the background prompt before approving it; approving the prompt starts the billable image-generation request.
5. Review the generated letter design, reposition editable elements, and explicitly approve the design. Run the pre-export print audit and download the letter PDF, or use **Export** for the full kit PDF.

## Commands

```sh
npm run dev      # Start the Vite development server
npm test         # Run the Node.js test suite
npm run build    # Type-check and create the production build in dist/
npm run preview  # Preview the production build locally
```

The automated suite currently contains 17 tests covering copy resolution, custom layout, geometry, text layout and safety, free-tier model selection, Gemini text requests, temporary-capacity handling, and model IDs in error messages. Tests use the Node built-in test runner; the Gemini contract test mocks network access and does not make a live API call.

## Print and export

PDFs are assembled in the browser with `pdf-lib` and `@pdf-lib/fontkit`. The full-kit export is configured as 15 physical pages across the product faces, with trim dimensions, 3 mm bleed on each side, vector crop marks, and a 300-DPI-equivalent raster workflow. Before exporting from the Thank You Letter flow, the operator must approve the design and pass through the pre-export audit, which reports print-safety issues such as text overflow and character substitutions.

Always inspect the downloaded PDF and confirm it meets the print vendor's requirements before sending it to production. This app does not implement CMYK conversion or vendor-specific preflight requirements.

## Data, API keys, and privacy

- Projects and settings are stored in this browser's `localStorage`; image data is stored in IndexedDB. Data does not sync to another browser or device. Clearing site data can remove projects and generated images, so keep any required exports and backups separately.
- Both Gemini API keys are saved in browser `localStorage` and requests are made directly from the browser. The image-generation key is sent only to the image model; the separate text key is sent only to the selected text model. This is intended for a trusted local, single-user environment, not public hosting or shared machines. Do not put real keys in a deployed frontend: browser-held keys are not secret from their users.
- Free-tier text API usage has quotas and may allow Google to use submitted content to improve its products. Avoid sending sensitive information. Gemini image generation uses a separate paid model and still requires billing-enabled API access. Model availability can depend on the API project; Google currently restricts Gemini 2.5 model access for new projects.
- Google may change free-tier model availability, quotas, and access over time; check the [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing) and [supported Interactions models](https://ai.google.dev/gemini-api/docs/interactions-overview#supported-models--agents) pages for current details.
- When requested, discussion notes, confirmed intake answers, and an optional reference image are sent to Gemini for their respective text or image operations. The app does not send raw discussion notes directly as the image-generation brief; the operator reviews the extracted answers and prompt first.
- Image-generation and text-model usage may be billable. Review the prompt and your provider usage before generating.

## Project structure

```text
src/
  components/       App shell, workflow steps, modals, and canvas preview
  config/           Product specifications and style directions
  services/         Gemini API, image masks, persistence, palette, and PDF export
  store/            Project state and background-job registry
  test/             Automated Node test files
  types/            API, geometry, product, and project types
  utils/            Copy resolution, geometry, text layout, and text safety
```

## Project documents

The parent directory contains the detailed requirements and decisions:

- [Product requirements](../PRD.md)
- [Technical stack and constraints](../TECH_STACK.md)
- [Thank You Letter intake specification](../INTAKE_SPEC.md)
- [Implementation plan](../IMPLEMENTATION_PLAN.md)
- [Test plan](testplan.md)

## Current scope and limitations

The current product is a local operator tool. Hosting, authentication, multi-user collaboration, customer self-service, Canva integration, other kit tiers, and vendor-specific CMYK/preflight work are outside the current scope. AI output is not guaranteed print-ready: human review and the PDF audit remain necessary. The browser must remain open while generation and export actions run.

For API-key, network, or billing errors, first verify the key in Settings, confirm that the Generative Language API is enabled for its Google project, check billing and quotas, and retry with a stable internet connection.