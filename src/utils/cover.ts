/** Scale that makes an image fill the screen completely ("cover"), cropping the overflow. */
export function coverScale(
  imageWidth: number,
  imageHeight: number,
  screenWidth: number,
  screenHeight: number,
): number {
  return Math.max(screenWidth / imageWidth, screenHeight / imageHeight);
}

/**
 * Scale that covers the screen plus `(maxOffsetX, maxOffsetY)` margin on each side so a
 * parallax layer never exposes empty edges when shifted.
 */
export function parallaxCoverScale(
  imageWidth: number,
  imageHeight: number,
  screenWidth: number,
  screenHeight: number,
  maxOffsetX: number,
  maxOffsetY = maxOffsetX,
): number {
  const ox = Math.max(0, maxOffsetX);
  const oy = Math.max(0, maxOffsetY);
  return coverScale(imageWidth, imageHeight, screenWidth + ox * 2, screenHeight + oy * 2);
}
