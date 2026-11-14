export const STYLE_IMAGE_API = '/api/style-image';
export const IMAGE_MODELS = ['nano-banana', 'nano-banana-pro'] as const;
export const VISION_MODELS = ['gemini-3-5-flash', 'gpt-5.6-sol'] as const;
export type ImageModel = typeof IMAGE_MODELS[number];
export const IMAGE_ASPECTS=['16:9','4:5','3:4','1:1'] as const;
export type ImageAspect=typeof IMAGE_ASPECTS[number];
export type VisionModel = typeof VISION_MODELS[number];
export type SenlingReference = {
  provider: 'senling-ais';
  id: string;
  providerJobId: string;
  model: ImageModel;
  imageUrl: string;
  inputSha256?: string;
  aspectRatio?:ImageAspect;
};
export type ImageJob =
  | { state: 'pending' | 'failed' }
  | { state: 'done'; reference: SenlingReference };

export const STYLE_VISION_PROMPT = `Inspect only visibly supported garment construction.
Reply with exactly one JSON value, no markdown. Choose one of:
{"schema":"garment-os/style-observation/v1","templateId":"bound-tank"}
only for a sleeveless knit tank with visibly bound neck and armholes;
{"schema":"garment-os/style-observation/v1","templateId":"hooded-zip-sweatshirt","pocket":false,"ribbing":false}
only for a full-zip hooded knit sweatshirt. Replace each boolean according to visible front patch pockets and visible rib knit bands at the cuffs and hem. A closed seam or fold is not a rib knit band.
Return null if the garment is unsupported, the required features are obscured, or you cannot reliably distinguish construction. Do not infer dimensions, materials, hidden pieces or additional fields.`;
