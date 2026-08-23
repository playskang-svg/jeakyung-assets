const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_BYTES = 5 * 1024 * 1024;

export async function prepareProfilePhoto(file) {
  if (!(file instanceof File) || !ALLOWED_TYPES.has(file.type)) throw new Error('JPEG, PNG, WebP 이미지만 선택할 수 있습니다.');
  if (file.size < 1 || file.size > MAX_BYTES) throw new Error('프로필 사진은 5MB 이하여야 합니다.');

  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap?.width || !bitmap?.height) throw new Error('이미지를 해석할 수 없습니다.');
  const sourceSize = Math.min(bitmap.width, bitmap.height);
  const sourceX = Math.floor((bitmap.width - sourceSize) / 2);
  const sourceY = Math.floor((bitmap.height - sourceSize) / 2);
  const outputSize = Math.min(512, sourceSize);
  const canvas = document.createElement('canvas');
  canvas.width = outputSize;
  canvas.height = outputSize;
  canvas.getContext('2d', { alpha: false }).drawImage(bitmap, sourceX, sourceY, sourceSize, sourceSize, 0, 0, outputSize, outputSize);
  bitmap.close();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.86));
  if (!blob) throw new Error('프로필 사진을 처리하지 못했습니다.');
  return new File([blob], `profile-${crypto.randomUUID()}.webp`, { type: 'image/webp' });
}
