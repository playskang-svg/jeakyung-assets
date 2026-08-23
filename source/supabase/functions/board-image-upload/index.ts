import { createSupabaseContext } from '@supabase/server';

const BUCKET = 'groupware-board-attachments';
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_PIXELS = 40_000_000;
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MIME_BY_FORMAT = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
} as const;
const EXTENSION_BY_FORMAT = { jpeg: 'jpg', png: 'png', webp: 'webp', gif: 'gif' } as const;
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type ImageFormat = keyof typeof MIME_BY_FORMAT;
type Dimensions = { width: number; height: number };

function response(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status, headers: CORS_HEADERS });
}

function detectFormat(bytes: Uint8Array): ImageFormat | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
    && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return 'png';
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF'
    && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') return 'webp';
  if (bytes.length >= 6) {
    const signature = String.fromCharCode(...bytes.slice(0, 6));
    if (signature === 'GIF87a' || signature === 'GIF89a') return 'gif';
  }
  return null;
}

// Pure byte-parsing dimension readers. Avoids depending on a native/WASM image
// library inside the edge runtime (which is flaky here - it was the actual
// cause of every inline image upload failing with a non-2xx response).
function readUint16BE(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function readUint32BE(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] << 24) >>> 0) + (bytes[offset + 1] << 16) + (bytes[offset + 2] << 8) + bytes[offset + 3];
}

function readUint16LE(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readPngDimensions(bytes: Uint8Array): Dimensions | null {
  if (bytes.length < 24) return null;
  return { width: readUint32BE(bytes, 16), height: readUint32BE(bytes, 20) };
}

function readGifDimensions(bytes: Uint8Array): Dimensions | null {
  if (bytes.length < 10) return null;
  return { width: readUint16LE(bytes, 6), height: readUint16LE(bytes, 8) };
}

function readJpegDimensions(bytes: Uint8Array): Dimensions | null {
  let offset = 2;
  while (offset < bytes.length - 8) {
    if (bytes[offset] !== 0xff) { offset += 1; continue; }
    const marker = bytes[offset + 1];
    const isStandalone = marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7);
    if (isStandalone) { offset += 2; continue; }
    if (marker === 0xd9) break;
    const isSOF = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSOF) return { height: readUint16BE(bytes, offset + 5), width: readUint16BE(bytes, offset + 7) };
    const segmentLength = readUint16BE(bytes, offset + 2);
    if (segmentLength < 2) break;
    offset += 2 + segmentLength;
  }
  return null;
}

function readWebpDimensions(bytes: Uint8Array): Dimensions | null {
  if (bytes.length < 30) return null;
  const fourCC = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);
  if (fourCC === 'VP8X') {
    return {
      width: 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16)),
      height: 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16)),
    };
  }
  if (fourCC === 'VP8L' && bytes[20] === 0x2f) {
    const b0 = bytes[21], b1 = bytes[22], b2 = bytes[23], b3 = bytes[24];
    return {
      width: 1 + (((b1 & 0x3f) << 8) | b0),
      height: 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)),
    };
  }
  if (fourCC === 'VP8 ' && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
    return { width: (bytes[26] | (bytes[27] << 8)) & 0x3fff, height: (bytes[28] | (bytes[29] << 8)) & 0x3fff };
  }
  return null;
}

function readDimensions(format: ImageFormat, bytes: Uint8Array): Dimensions {
  const dimensions = format === 'png' ? readPngDimensions(bytes)
    : format === 'gif' ? readGifDimensions(bytes)
    : format === 'jpeg' ? readJpegDimensions(bytes)
    : readWebpDimensions(bytes);
  if (!dimensions || !dimensions.width || !dimensions.height) {
    throw new Error('이미지를 해석할 수 없습니다. 손상되지 않은 이미지인지 확인해 주세요.');
  }
  return dimensions;
}

export default {
  async fetch(request: Request) {
    if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
    if (request.method !== 'POST') return response({ error: 'method_not_allowed' }, 405);

    const { data: context, error: contextError } = await createSupabaseContext(request, { auth: 'user' });
    if (contextError || !context) return response({ error: 'authentication_required' }, contextError?.status ?? 401);

    try {
      const form = await request.formData();
      const file = form.get('file');
      const boardId = String(form.get('board_id') ?? '');
      const postId = String(form.get('post_id') ?? '');
      const originalName = String(form.get('original_name') ?? (file instanceof File ? file.name : 'image'));
      const replacesAttachmentId = String(form.get('replaces_attachment_id') ?? '') || null;
      const userId = String(context.userClaims?.id ?? context.jwtClaims?.sub ?? '');

      if (!(file instanceof File) || !boardId || !postId || !userId) return response({ error: 'invalid_upload_request' }, 400);
      if (file.size < 1 || file.size > MAX_IMAGE_BYTES) return response({ error: 'inline_image_size_exceeded' }, 413);
      if (!ALLOWED_MIME_TYPES.has(file.type)) return response({ error: 'image_type_not_allowed' }, 415);
      if (!/\.(jpe?g|png|webp|gif)$/i.test(originalName)) return response({ error: 'image_extension_not_allowed' }, 415);

      const bytes = new Uint8Array(await file.arrayBuffer());
      const format = detectFormat(bytes);
      if (!format || MIME_BY_FORMAT[format] !== file.type) return response({ error: 'image_signature_mismatch' }, 415);

      const { width, height } = readDimensions(format, bytes);
      if (!width || !height || width * height > MAX_PIXELS) return response({ error: 'invalid_image_dimensions' }, 422);

      const storagePath = `${boardId}/${userId}/inline/${postId}/${crypto.randomUUID()}.${EXTENSION_BY_FORMAT[format]}`;
      const { error: uploadError } = await context.supabase.storage.from(BUCKET).upload(storagePath, file, {
        contentType: MIME_BY_FORMAT[format],
        upsert: false,
      });
      if (uploadError) throw uploadError;

      const { data: attachment, error: registerError } = await context.supabaseAdmin.rpc('register_inline_board_image', {
        p_board_id: boardId,
        p_post_id: postId,
        p_storage_path: storagePath,
        p_original_name: originalName,
        p_mime_type: MIME_BY_FORMAT[format],
        p_file_size: file.size,
        p_image_width: width,
        p_image_height: height,
        p_image_format: format,
        p_uploader_id: userId,
        p_replaces_attachment_id: replacesAttachmentId,
      });
      if (registerError) {
        await context.supabase.storage.from(BUCKET).remove([storagePath]);
        throw registerError;
      }

      return response({ attachment });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'image_upload_failed';
      return response({ error: message }, 400);
    }
  },
};
