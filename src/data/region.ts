/** Default area of interest (lng/lat): Benelux + Switzerland + neighbours. */
export const DEFAULT_BBOX: [number, number, number, number] = [2, 46, 11, 54];

export const bboxParam = (b: [number, number, number, number]) => b.join(",");
