const images = new Map<string, Uint8Array>();
const MAX_ENTRIES = 80;

export function takeCachedImage(key: string) {
  const hit = images.get(key);
  if (!hit) return null;
  images.delete(key);
  images.set(key, hit);
  return hit;
}

export function storeCachedImage(key: string, body: Uint8Array) {
  if (images.has(key)) images.delete(key);
  images.set(key, body);
  while (images.size > MAX_ENTRIES) {
    const oldest = images.keys().next().value;
    if (oldest === undefined) break;
    images.delete(oldest);
  }
}

export function forgetCachedImage(key: string) {
  images.delete(key);
}
