import logoImg from '../assets/logo.png';
import titleImg from '../assets/title.png';
import rtitleImg from '../assets/rtitle.png';

export const NUM_UNIQUE_CATS = 12;
export const CAT_PATHS = Array.from({ length: NUM_UNIQUE_CATS }, (_, i) => `/emojis/floatable/${i + 1}.png`);

// Module-level image cache so loaded and decoded Image objects can be shared instantly
const imageCache = new Map();

/**
 * Preload and decode a single image.
 */
function preloadImage(src) {
  if (imageCache.has(src)) {
    const existing = imageCache.get(src);
    if (existing.complete && existing.naturalWidth > 0) {
      return Promise.resolve(existing);
    }
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.src = src;

    const onDone = () => {
      imageCache.set(src, img);
      if (typeof img.decode === 'function') {
        img.decode()
          .then(() => resolve(img))
          .catch(() => resolve(img));
      } else {
        resolve(img);
      }
    };

    if (img.complete && img.naturalWidth > 0) {
      onDone();
    } else {
      img.onload = onDone;
      img.onerror = () => {
        // Resolve even on error so preloading is not blocked
        console.warn(`[AssetPreloader] Failed to preload image: ${src}`);
        imageCache.set(src, img);
        resolve(img);
      };
    }
  });
}

/**
 * Preload all critical fonts.
 */
async function preloadFonts() {
  if (typeof document === 'undefined' || !document.fonts) return;

  try {
    await document.fonts.ready;

    const fontSpecs = [
      '400 32px "Titan One"',
      '600 24px "Fredoka"',
      '700 24px "Fredoka"',
      '500 16px "Plus Jakarta Sans"',
      '600 16px "Plus Jakarta Sans"',
      '700 16px "Plus Jakarta Sans"',
      '800 16px "Plus Jakarta Sans"',
      '500 14px "JetBrains Mono"',
    ];

    if (typeof document.fonts.load === 'function') {
      await Promise.allSettled(fontSpecs.map((spec) => document.fonts.load(spec)));
    }
  } catch (err) {
    console.warn('[AssetPreloader] Font preloading non-fatal error:', err);
  }
}

/**
 * Preloads all essential fonts and images before the home page / app mounts.
 * Reports progress via optional onProgress callback (0.0 to 1.0).
 */
export async function preloadAllAppAssets(onProgress) {
  const imagesToLoad = [
    logoImg,
    titleImg,
    rtitleImg,
    '/logo_mini.png',
    '/logo.png',
    '/title.png',
    '/rtitle.png',
    ...CAT_PATHS,
  ];

  // Deduplicate URLs
  const uniqueImages = Array.from(new Set(imagesToLoad.filter(Boolean)));
  const totalItems = uniqueImages.length + 1; // +1 for fonts batch
  let completedItems = 0;

  const updateProgress = () => {
    completedItems++;
    if (onProgress) {
      onProgress(Math.min(1.0, completedItems / totalItems));
    }
  };

  const imagePromises = uniqueImages.map(async (src) => {
    const img = await preloadImage(src);
    updateProgress();
    return img;
  });

  const fontPromise = preloadFonts().then(() => {
    updateProgress();
  });

  // Safety ceiling: never hang for more than 5.5s under bad network conditions
  const safetyTimeout = new Promise((resolve) => setTimeout(resolve, 5500));

  await Promise.race([
    Promise.all([...imagePromises, fontPromise]),
    safetyTimeout,
  ]);

  if (onProgress) onProgress(1.0);
}

/**
 * Returns the cached preloaded images for the 12 floating cats.
 */
export function getPreloadedCatImages() {
  return CAT_PATHS.map((path) => {
    if (imageCache.has(path)) {
      return imageCache.get(path);
    }
    const img = new Image();
    img.src = path;
    imageCache.set(path, img);
    return img;
  });
}
