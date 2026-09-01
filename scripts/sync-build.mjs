#!/usr/bin/env node
// 빌드 결과를 배포 트리에 반영한다.
//
// 이 저장소는 두 갈래로 굴러간다. 루트의 index.html·news/·privacy/ 는 손으로
// 관리하고, assets/ 와 groupware/index.html 만 빌드 산출물에서 가져온다.
// 그런데 자산 파일명에는 매 빌드마다 바뀌는 해시가 붙으므로, 손으로 관리하는
// HTML 안의 참조를 새 이름으로 갈아 끼워야 한다.
//
// 이 과정을 매번 손으로 하다가 실제로 두 번 사고가 났다.
//   - 영상 파일을 지우고 배포 트리의 사본을 남겨 1.5MB 가 계속 나갔다
//   - 해시에 '-' 가 들어간 파일(mountPublicPopupLayer-BTO-0ZRB.css)에서
//     접두사 계산이 어긋나 참조가 깨질 뻔했다
// 그래서 절차를 코드로 고정한다. 사람이 기억할 일을 줄이는 것이 목적이다.

import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'source/dist');
const HAND_WRITTEN = ['index.html', 'news/index.html', 'privacy/index.html'];

// 자산 이름은 <이름>-<해시8>.<확장자> 꼴이다. 해시에도 '-' 가 들어갈 수 있으므로
// 끝에서 8글자만 떼어낸다. 여기서 실수하면 참조가 조용히 깨진다.
const keyOf = (name) => {
  const dot = name.lastIndexOf('.');
  const stem = name.slice(0, dot);
  return `${stem.replace(/-[A-Za-z0-9_-]{8}$/, '')}${name.slice(dot)}`;
};

const fail = (message) => { console.error(`\n✖ ${message}\n`); process.exit(1); };

if (!existsSync(dist)) fail('source/dist 가 없습니다. 먼저 npm run build 를 실행하세요.');

// 1) assets/ 를 빌드 결과로 통째로 교체한다. 남겨 두면 옛 파일이 계속 배포된다.
await rm(path.join(root, 'assets'), { recursive: true, force: true });
await cp(path.join(dist, 'assets'), path.join(root, 'assets'), { recursive: true });

// 2) 그룹웨어 SPA 는 빌드본을 그대로 쓴다.
await mkdir(path.join(root, 'groupware'), { recursive: true });
await cp(path.join(dist, 'groupware/index.html'), path.join(root, 'groupware/index.html'));

// 3) 손으로 관리하는 HTML 의 자산 참조를 새 해시로 갈아 끼운다.
const built = new Map();
for (const name of await readdir(path.join(root, 'assets'))) built.set(keyOf(name), name);

const unresolved = [];
for (const rel of HAND_WRITTEN) {
  const file = path.join(root, rel);
  const before = await readFile(file, 'utf8');
  const after = before.replace(/assets\/([A-Za-z0-9_.-]+\.(?:js|css|webp|png|jpe?g|svg|woff2?))/g,
    (whole, name) => {
      const replacement = built.get(keyOf(name));
      if (!replacement) { unresolved.push(`${rel} → ${name}`); return whole; }
      return whole.replace(name, replacement);
    });
  if (after !== before) await writeFile(file, after);
}
if (unresolved.length) fail(`빌드 결과에서 짝을 찾지 못한 참조:\n   ${unresolved.join('\n   ')}`);

// 4) 배포되는 모든 HTML 이 실재하는 자산만 가리키는지 마지막으로 확인한다.
const missing = [];
for (const rel of [...HAND_WRITTEN, 'groupware/index.html']) {
  const html = await readFile(path.join(root, rel), 'utf8');
  for (const [, name] of html.matchAll(/assets\/([A-Za-z0-9_.-]+)/g)) {
    if (!existsSync(path.join(root, 'assets', name))) missing.push(`${rel} → ${name}`);
  }
}
if (missing.length) fail(`실재하지 않는 자산을 가리킵니다:\n   ${missing.join('\n   ')}`);

console.log(`✔ 자산 ${built.size}개 반영, 참조 정상 (${HAND_WRITTEN.length + 1}개 HTML 확인)`);
