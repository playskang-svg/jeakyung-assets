export const EMPTY_BOARD_DOCUMENT = Object.freeze({
  type: 'doc',
  content: [{ type: 'paragraph' }],
});

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const ALLOWED_IMAGE_EXTENSION = /\.(jpe?g|png|webp|gif)$/i;
const MAX_LONG_EDGE = 2560;
const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;

function decodeImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const dimensions = { width: image.naturalWidth, height: image.naturalHeight };
      URL.revokeObjectURL(url);
      if (!dimensions.width || !dimensions.height) reject(new Error('이미지 크기를 확인할 수 없습니다.'));
      else resolve(dimensions);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('손상되었거나 지원하지 않는 이미지입니다.'));
    };
    image.src = url;
  });
}

function canvasBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('이미지를 최적화하지 못했습니다.'));
    }, type, quality);
  });
}

async function resizeRaster(file, dimensions) {
  const scale = Math.min(1, MAX_LONG_EDGE / Math.max(dimensions.width, dimensions.height));
  if (scale === 1) return { file, ...dimensions, resized: false };

  const bitmap = await createImageBitmap(file);
  const width = Math.max(1, Math.round(dimensions.width * scale));
  const height = Math.max(1, Math.round(dimensions.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { alpha: file.type === 'image/png' });
  if (!context) throw new Error('이미지를 최적화할 수 없는 브라우저입니다.');
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const quality = file.type === 'image/jpeg' ? 0.84 : file.type === 'image/webp' ? 0.82 : undefined;
  const blob = await canvasBlob(canvas, file.type, quality);
  const resizedFile = new File([blob], file.name, { type: file.type, lastModified: file.lastModified });
  return { file: resizedFile, width, height, resized: true };
}

export async function prepareInlineImage(file, { maxBytes = DEFAULT_MAX_BYTES, preserveOriginal = false } = {}) {
  if (!(file instanceof File)) throw new Error('이미지 파일을 선택해 주세요.');
  if (!ALLOWED_IMAGE_TYPES.has(file.type) || !ALLOWED_IMAGE_EXTENSION.test(file.name)) {
    throw new Error('JPEG, PNG, WebP, GIF 이미지만 사용할 수 있습니다. SVG는 허용하지 않습니다.');
  }
  if (file.size < 1 || file.size > maxBytes) throw new Error(`이미지는 1개당 ${Math.floor(maxBytes / 1024 / 1024)}MB 이하여야 합니다.`);
  const dimensions = await decodeImage(file);
  if (dimensions.width * dimensions.height > 40_000_000) throw new Error('이미지 해상도가 너무 큽니다.');
  if (file.type === 'image/gif' || preserveOriginal) return { file, originalName: file.name, ...dimensions, resized: false };
  const prepared = await resizeRaster(file, dimensions);
  if (prepared.file.size > maxBytes) throw new Error('최적화 후에도 이미지 용량이 제한을 초과합니다.');
  return { ...prepared, originalName: file.name };
}

export function sanitizePastedHtml(html) {
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  parsed.querySelectorAll('script, iframe, object, embed, style, link, meta, form, input, button, svg').forEach((element) => element.remove());
  parsed.body.querySelectorAll('*').forEach((element) => {
    [...element.attributes].forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim().toLowerCase();
      if (name.startsWith('on') || name === 'style' || name === 'srcdoc'
        || ((name === 'href' || name === 'src') && /^(javascript|data|vbscript):/.test(value))) {
        element.removeAttribute(attribute.name);
      }
    });
  });
  return parsed.body.innerHTML;
}

export function countInlineImages(documentValue) {
  let count = 0;
  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'inlineImage') count += 1;
    if (Array.isArray(node.content)) node.content.forEach(visit);
  };
  visit(documentValue);
  return count;
}

export function getInlineImageIds(documentValue) {
  const ids = [];
  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'inlineImage' && node.attrs?.attachmentId) ids.push(node.attrs.attachmentId);
    if (Array.isArray(node.content)) node.content.forEach(visit);
  };
  visit(documentValue);
  return ids;
}

export function legacyTextToDocument(text = '') {
  const lines = String(text).split(/\r?\n/);
  return {
    type: 'doc',
    content: lines.map((line) => line
      ? { type: 'paragraph', content: [{ type: 'text', text: line }] }
      : { type: 'paragraph' }),
  };
}

export function boardDocumentHasContent(documentValue) {
  let hasContent = false;
  const visit = (node) => {
    if (hasContent || !node || typeof node !== 'object') return;
    // 주소로 연결한 이미지 하나만 있는 글도 빈 글이 아니다.
    if (node.type === 'inlineImage' || node.type === 'externalImage' || node.type === 'youtubeEmbed' || (node.type === 'text' && node.text?.trim())) hasContent = true;
    if (Array.isArray(node.content)) node.content.forEach(visit);
  };
  visit(documentValue);
  return hasContent;
}
