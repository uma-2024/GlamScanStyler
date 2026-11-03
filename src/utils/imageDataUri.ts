type ImageLikeAsset = {
  base64?: string | null;
  type?: string | null;
};

const supportedImageTypes = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
  'image/heif',
]);

export const buildImageDataUri = (asset: ImageLikeAsset): string | null => {
  if (!asset.base64) {
    return null;
  }

  const contentType = String(asset.type || 'image/jpeg').toLowerCase();
  const safeContentType = supportedImageTypes.has(contentType) ? contentType : 'image/jpeg';

  return `data:${safeContentType};base64,${asset.base64}`;
};
