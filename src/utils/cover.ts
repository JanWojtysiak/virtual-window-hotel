/** Scale that makes an image fill the screen completely ("cover"), cropping the overflow. */
export function coverScale(
  imageWidth: number,
  imageHeight: number,
  screenWidth: number,
  screenHeight: number,
): number {
  return Math.max(screenWidth / imageWidth, screenHeight / imageHeight);
}
