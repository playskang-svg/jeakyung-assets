// 휴대폰에서 찍은 사진은 그대로 올리면 두 가지 이유로 막힌다.
//  1) 아이폰 기본 포맷(HEIC)은 스토리지 버킷이 받지 않는 MIME 이다.
//  2) 요즘 카메라 사진은 한 장에 5MB 를 쉽게 넘긴다.
// 그래서 올리기 전에 브라우저에서 한 번 열어 보고, 필요하면 긴 변 기준으로
// 줄여서 JPEG 로 다시 굽는다. 여기서 통과한 파일만 스토리지로 보낸다.

const MAX_EDGE = 1920;
const MAX_BYTES = 5 * 1024 * 1024;
const JPEG_QUALITY = 0.85;
const PASSTHROUGH_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

// 브라우저가 이 파일을 그림으로 열 수 있는지 본다. HEIC 처럼 디코딩을 못 하는
// 포맷이면 null 을 돌려주고, 호출한 쪽에서 원본 규격으로만 판단하게 한다.
async function decode(file) {
  if (typeof createImageBitmap !== 'function') return null;
  try {
    return await createImageBitmap(file);
  } catch {
    return null;
  }
}

function encode(bitmap, width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('이미지를 변환하지 못했습니다.'))),
      'image/jpeg',
      JPEG_QUALITY,
    );
  });
}

// 업로드할 파일을 돌려준다. 손댈 필요가 없으면 원본을 그대로 준다.
export default async function prepareImageForUpload(file) {
  if (!file) throw new Error('파일을 선택해 주세요.');
  if (file.type && !file.type.startsWith('image/')) {
    throw new Error('이미지 파일만 올릴 수 있습니다.');
  }

  const bitmap = await decode(file);

  if (!bitmap) {
    // 열어 보지 못했으니 원본 그대로 보낼 수 있는지만 확인한다.
    if (!PASSTHROUGH_TYPES.includes(file.type)) {
      throw new Error('이 브라우저가 열지 못하는 사진 형식입니다. JPG 나 PNG 로 저장해서 올려 주세요.');
    }
    if (file.size > MAX_BYTES) {
      throw new Error('사진 용량이 5MB 를 넘습니다. 크기를 줄여서 올려 주세요.');
    }
    return file;
  }

  try {
    const longEdge = Math.max(bitmap.width, bitmap.height);
    const withinLimits = longEdge <= MAX_EDGE && file.size <= MAX_BYTES;
    // 규격 안에 드는 지원 포맷이면 다시 굽지 않는다. PNG 투명도와 GIF 움직임을 지키기 위해서다.
    if (withinLimits && PASSTHROUGH_TYPES.includes(file.type)) return file;

    const scale = longEdge > MAX_EDGE ? MAX_EDGE / longEdge : 1;
    const blob = await encode(
      bitmap,
      Math.round(bitmap.width * scale),
      Math.round(bitmap.height * scale),
    );
    if (blob.size > MAX_BYTES) {
      throw new Error('사진을 줄여도 5MB 를 넘습니다. 더 작은 사진으로 올려 주세요.');
    }
    const name = `${(file.name || 'photo').replace(/\.[^.]+$/, '')}.jpg`;
    return new File([blob], name, { type: 'image/jpeg' });
  } finally {
    bitmap.close?.();
  }
}
