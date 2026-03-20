/**
 * 번들 크기 분석 스크립트
 *
 * frontend/dist/assets/ 의 JS/CSS 파일별 gzip 크기를 측정하고
 * 마크다운 테이블로 출력한다.
 * 전체 JS 번들 합계가 임계값(500KB gzipped)을 초과하면 exit 1.
 *
 * 사용법: node scripts/bundle-size.mjs
 * (frontend/dist/ 가 이미 빌드되어 있어야 함)
 */

import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { gzipSync } from "node:zlib";

// --- 설정 ---
const DIST_DIR = resolve(import.meta.dirname, "..", "dist", "assets");
const JS_GZIP_LIMIT_BYTES = 500 * 1024; // 500KB

// --- 유틸리티 ---

/** 바이트를 사람이 읽기 쉬운 문자열로 변환 */
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
}

/** 파일의 원본 크기와 gzip 크기를 반환 */
function measureFile(filePath) {
  const raw = readFileSync(filePath);
  const gzipped = gzipSync(raw);
  return { raw: raw.length, gzip: gzipped.length };
}

// --- 메인 ---

let files;
try {
  files = readdirSync(DIST_DIR);
} catch {
  console.error(`❌ dist/assets 디렉토리를 찾을 수 없습니다: ${DIST_DIR}`);
  console.error("   먼저 'npm run build'를 실행하세요.");
  process.exit(1);
}

const assets = files
  .filter((f) => /\.(js|css)$/.test(f))
  .map((name) => {
    const filePath = join(DIST_DIR, name);
    const size = measureFile(filePath);
    const type = name.endsWith(".js") ? "JS" : "CSS";
    return { name, type, ...size };
  })
  .sort((a, b) => b.gzip - a.gzip); // gzip 크기 내림차순

if (assets.length === 0) {
  console.error("❌ dist/assets 에 JS/CSS 파일이 없습니다.");
  process.exit(1);
}

// JS/CSS 합계 계산
const jsTotal = assets
  .filter((a) => a.type === "JS")
  .reduce((sum, a) => sum + a.gzip, 0);
const cssTotal = assets
  .filter((a) => a.type === "CSS")
  .reduce((sum, a) => sum + a.gzip, 0);
const grandTotal = jsTotal + cssTotal;

// 마크다운 테이블 출력
console.log("## 📦 번들 크기 리포트\n");
console.log("| 파일 | 타입 | 원본 | Gzip |");
console.log("|------|------|------|------|");
for (const a of assets) {
  console.log(
    `| \`${a.name}\` | ${a.type} | ${formatBytes(a.raw)} | ${formatBytes(a.gzip)} |`,
  );
}

console.log("");
console.log(`**JS 합계 (gzip):** ${formatBytes(jsTotal)}`);
console.log(`**CSS 합계 (gzip):** ${formatBytes(cssTotal)}`);
console.log(`**전체 합계 (gzip):** ${formatBytes(grandTotal)}`);

// 임계값 검사
const overLimit = jsTotal > JS_GZIP_LIMIT_BYTES;
if (overLimit) {
  console.log(
    `\n⚠️ JS 번들 합계(${formatBytes(jsTotal)})가 임계값(${formatBytes(JS_GZIP_LIMIT_BYTES)})을 초과했습니다!`,
  );
  process.exit(1);
} else {
  const remaining = JS_GZIP_LIMIT_BYTES - jsTotal;
  console.log(
    `\n✅ JS 번들 합계가 임계값 이내입니다 (여유: ${formatBytes(remaining)})`,
  );
}
