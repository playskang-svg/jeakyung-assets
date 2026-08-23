import { ImageMagick, initializeImageMagick } from '@imagemagick/magick-wasm';
import { createClient } from '@supabase/supabase-js';

const BUCKET = 'groupware-profile-photos';
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MIME_BY_FORMAT = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' } as const;
const EXTENSION_BY_FORMAT = { jpeg: 'jpg', png: 'png', webp: 'webp' } as const;
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-signup-photo',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const SAFE_ERROR_MESSAGES = new Set([
  'profile_photo_decode_failed',
  'authentication_required',
  'signup_photo_token_invalid',
  'profile_photo_upload_failed',
]);

const wasmBytes = await Deno.readFile(new URL('magick.wasm', import.meta.resolve('npm:@imagemagick/magick-wasm@0.0.41')));
await initializeImageMagick(wasmBytes);

type ImageFormat = keyof typeof MIME_BY_FORMAT;

function reply(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status, headers: CORS_HEADERS });
}

function detectFormat(bytes: Uint8Array): ImageFormat | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
    && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return 'png';
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF'
    && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') return 'webp';
  return null;
}

function inspectImage(bytes: Uint8Array) {
  try {
    return ImageMagick.read(bytes, (image) => ({ width: image.width, height: image.height }));
  } catch {
    throw new Error('profile_photo_decode_failed');
  }
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((item) => item.toString(16).padStart(2, '0')).join('');
}

export default {
  async fetch(request: Request) {
    if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
    if (request.method !== 'POST') return reply({ error: 'method_not_allowed' }, 405);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (!supabaseUrl || !serviceRoleKey || !anonKey) return reply({ error: 'server_configuration_missing' }, 500);

    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
    let uploadedPath = '';
    try {
      const form = await request.formData();
      const file = form.get('file');
      const targetUserId = String(form.get('user_id') ?? '');
      const signupToken = String(form.get('signup_token') ?? '');
      if (!(file instanceof File) || !targetUserId) return reply({ error: 'invalid_profile_photo_request' }, 400);
      if (file.size < 1 || file.size > MAX_BYTES) return reply({ error: 'profile_photo_size_exceeded' }, 413);
      if (!ALLOWED.has(file.type)) return reply({ error: 'profile_photo_type_not_allowed' }, 415);

      const bytes = new Uint8Array(await file.arrayBuffer());
      const format = detectFormat(bytes);
      if (!format || MIME_BY_FORMAT[format] !== file.type) return reply({ error: 'profile_photo_signature_mismatch' }, 415);
      const dimensions = inspectImage(bytes);
      if (!dimensions.width || !dimensions.height || dimensions.width !== dimensions.height || dimensions.width > 512) {
        return reply({ error: 'profile_photo_square_512_required' }, 422);
      }

      const authorization = request.headers.get('authorization') ?? '';
      const bearer = authorization.match(/^Bearer\s+(.+)$/i)?.[1] ?? '';
      const { data: authData } = bearer ? await admin.auth.getUser(bearer) : { data: { user: null } };
      const authenticatedUser = authData.user;

      if (!authenticatedUser && !signupToken) return reply({ error: 'authentication_required' }, 401);
      if (!authenticatedUser) {
        const tokenHash = await sha256(signupToken);
        const { data: pendingProfile, error: pendingError } = await admin.from('profiles')
          .select('id')
          .eq('id', targetUserId)
          .eq('membership_status', 'pending')
          .eq('signup_photo_token_hash', tokenHash)
          .gt('signup_photo_token_expires_at', new Date().toISOString())
          .maybeSingle();
        if (pendingError || !pendingProfile) return reply({ error: 'signup_photo_token_invalid' }, 403);
      }

      uploadedPath = `${targetUserId}/${crypto.randomUUID()}.${EXTENSION_BY_FORMAT[format]}`;
      const storedFile = new File([bytes], `profile.${EXTENSION_BY_FORMAT[format]}`, { type: MIME_BY_FORMAT[format] });
      const { error: uploadError } = await admin.storage.from(BUCKET).upload(uploadedPath, storedFile, {
        contentType: MIME_BY_FORMAT[format], upsert: false,
      });
      if (uploadError) throw uploadError;

      if (authenticatedUser) {
        const userClient = createClient(supabaseUrl, anonKey, {
          global: { headers: { Authorization: authorization } },
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { error: registerError } = await userClient.rpc('set_profile_photo', {
          p_user_id: targetUserId,
          p_storage_path: uploadedPath,
          p_mime_type: MIME_BY_FORMAT[format],
          p_file_size: file.size,
        });
        if (registerError) throw registerError;
      } else {
        const { error: registerError } = await admin.rpc('register_signup_profile_photo', {
          p_user_id: targetUserId,
          p_token_hash: await sha256(signupToken),
          p_storage_path: uploadedPath,
          p_mime_type: MIME_BY_FORMAT[format],
          p_file_size: file.size,
        });
        if (registerError) throw registerError;
      }

      return reply({ storage_path: uploadedPath });
    } catch (error) {
      if (uploadedPath) await admin.storage.from(BUCKET).remove([uploadedPath]);
      const message = error instanceof Error && SAFE_ERROR_MESSAGES.has(error.message)
        ? error.message
        : 'profile_photo_upload_failed';
      return reply({ error: message }, 400);
    }
  },
};
