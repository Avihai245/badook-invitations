/**
 * The design studio's numbers in one place (isomorphic: the browser and the server read the same
 * values). Feature `art_direction` (VIP): "design it for me" — three concepts from the host's photos.
 */
export const ART_DIRECTION = {
  /** photos the host gives */
  minPhotos: 3,
  maxPhotos: 5,
  /** each photo goes to the AI as a small JPEG (long side, px; quality) — made on the device */
  aiLongSide: 640,
  aiQuality: 0.78,
  /** the most a photo may weigh on the way (bytes, decoded) */
  aiMaxBytes: 360 * 1024,
  /** what is uploaded when a concept is used from the wizard (long side, px; quality) */
  uploadLongSide: 2048,
  uploadQuality: 0.86,
  /** the mood in a few words */
  moodMax: 80,
  /** the AI's answer: how long we wait, how long it may be */
  timeoutMs: 45_000,
  maxTokens: 4096,
  /** a concept's name and its one-line rationale (the host's language) */
  nameMax: 40,
  rationaleMax: 180,
  /** picture bands (text & picture sections without text) a concept may add */
  maxBands: 2,
  /** the request body (the photos in it), bytes */
  maxBodyBytes: 2_600_000,
} as const;
