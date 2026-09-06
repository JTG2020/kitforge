export interface StyleDirection {
  id: string;
  name: string;
  description: string;
  promptText: string;
}

export const STYLE_DIRECTIONS: StyleDirection[] = [
  {
    id: 'letterpress',
    name: 'Ornamental letterpress',
    description: 'Fine engraved rules, small geometric corner devices, the restraint of a good certificate.',
    promptText: 'Ornamental letterpress. Fine engraved rules, small geometric corner devices, the restraint of a good certificate.',
  },
  {
    id: 'botanical',
    name: 'Organic botanical',
    description: 'Softly drawn leaves and stems, hand-inked, generous and calm.',
    promptText: 'Organic botanical. Softly drawn leaves and stems, hand-inked, generous and calm.',
  },
  {
    id: 'geometric',
    name: 'Modern geometric',
    description: 'Crisp bands and rules, confident blocks of flat colour, nothing fussy.',
    promptText: 'Modern geometric. Crisp bands and rules, confident blocks of flat colour, nothing fussy.',
  },
  {
    id: 'art-deco',
    name: 'Art deco',
    description: 'Symmetrical stepped linework, fan motifs, fine parallel rules.',
    promptText: 'Art deco. Symmetrical stepped linework, fan motifs, fine parallel rules.',
  },
  {
    id: 'watercolour',
    name: 'Soft watercolour',
    description: 'Colour pooling and fading, loose edges, quiet and warm.',
    promptText: 'Soft watercolour. Colour pooling and fading, loose edges, quiet and warm.',
  },
  {
    id: 'guilloche',
    name: 'Fine guilloche',
    description: 'Dense concentric engraving, the feel of a banknote border.',
    promptText: 'Fine guilloche. Dense concentric engraving, the feel of a banknote border.',
  },
];

export interface VariantHint {
  id: string;
  name: string;
  promptText: string;
}

export const VARIANT_HINTS: VariantHint[] = [
  {
    id: 'hint-letterpress',
    name: 'Ornamental letterpress edge',
    promptText: 'Ornamental letterpress. Fine double rules following the edge, with small geometric corner ornaments tucked into the very corners.',
  },
  {
    id: 'hint-botanical',
    name: 'Organic botanical edge',
    promptText: 'Organic botanical. A slim garland of leaves and stems tracing the edge, denser at two opposite corners, drawn softly by hand.',
  },
  {
    id: 'hint-geometric',
    name: 'Bold modern geometry edge',
    promptText: 'Bold modern geometry. A crisp solid rule around the edge in the primary colour with a single accent-colour notch at one corner.',
  },
  {
    id: 'hint-art-deco',
    name: 'Art deco edge',
    promptText: 'Art deco. Symmetrical stepped linework tracing the edge, with fine parallel accent rules just inside it.',
  },
  {
    id: 'hint-watercolour',
    name: 'Soft watercolour wash edge',
    promptText: 'Soft watercolour wash. Colour pooling only at the very edges and fading to nothing within a short distance, plus a fine hairline rule.',
  },
  {
    id: 'hint-guilloche',
    name: 'Fine engraved guilloche edge',
    promptText: 'Fine engraved guilloche. Dense concentric linework forming a narrow certificate-style border hugging the edge.',
  },
];
