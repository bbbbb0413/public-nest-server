/**
 * docs/ 하위의 마크다운 파일을 AI Service 지식베이스에 업로드하는 시드 스크립트
 *
 * 사용법:
 *   AI_SERVICE_URL=http://localhost:3004 npx ts-node scripts/seed-knowledge.ts
 *
 * 옵션:
 *   --dir   업로드할 디렉토리 (기본: docs/)
 *   --ext   파일 확장자 필터 (기본: .md)
 *   --dry   실제 업로드 없이 파일 목록만 출력
 */

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';

const BASE_URL = process.env.AI_SERVICE_URL ?? 'http://localhost:3004';
const ROOT = path.resolve(__dirname, '..');

function parseArgs() {
  const args = process.argv.slice(2);
  const dir = args.find((a) => a.startsWith('--dir='))?.split('=')[1] ?? 'docs';
  const ext = args.find((a) => a.startsWith('--ext='))?.split('=')[1] ?? '.md';
  const dry = args.includes('--dry');
  return { dir, ext, dry };
}

function collectFiles(dir: string, ext: string): string[] {
  const absDir = path.join(ROOT, dir);
  if (!fs.existsSync(absDir)) {
    console.error(`디렉토리가 존재하지 않습니다: ${absDir}`);
    process.exit(1);
  }

  const results: string[] = [];

  function walk(current: string) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile() && entry.name.endsWith(ext)) {
        results.push(full);
      }
    }
  }

  walk(absDir);
  return results;
}

function uploadFile(
  filePath: string,
): Promise<{
  fileName: string;
  status: string;
  chunkCount?: number;
  error?: string;
}> {
  return new Promise((resolve) => {
    const fileName = path.relative(ROOT, filePath);
    const content = fs.readFileSync(filePath);
    const boundary = `----FormBoundary${Date.now()}`;

    const body = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${path.basename(filePath)}"\r\nContent-Type: text/markdown\r\n\r\n`,
      ),
      content,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);

    const url = new URL(`${BASE_URL}/knowledge/documents`);
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
      },
    };

    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.request(options, (res) => {
      let raw = '';
      res.on('data', (chunk) => (raw += chunk));
      res.on('end', () => {
        try {
          const json = JSON.parse(raw);
          resolve({
            fileName,
            status: json.status,
            chunkCount: json.chunkCount,
          });
        } catch {
          resolve({
            fileName,
            status: 'error',
            error: `파싱 실패: ${raw.slice(0, 100)}`,
          });
        }
      });
    });

    req.on('error', (e) =>
      resolve({ fileName, status: 'error', error: e.message }),
    );
    req.write(body);
    req.end();
  });
}

async function main() {
  const { dir, ext, dry } = parseArgs();

  console.log(`\n📚 지식베이스 시드 스크립트`);
  console.log(`   대상 디렉토리: ${dir}`);
  console.log(`   파일 확장자: ${ext}`);
  console.log(`   업로드 URL: ${BASE_URL}\n`);

  const files = collectFiles(dir, ext);

  if (files.length === 0) {
    console.log('업로드할 파일이 없습니다.');
    return;
  }

  console.log(`총 ${files.length}개 파일 발견:\n`);
  files.forEach((f) => console.log(`  - ${path.relative(ROOT, f)}`));
  console.log();

  if (dry) {
    console.log('--dry 모드: 실제 업로드를 건너뜁니다.');
    return;
  }

  console.log('업로드 시작...\n');

  const results = [];
  for (const filePath of files) {
    const relPath = path.relative(ROOT, filePath);
    process.stdout.write(`  ⏳ ${relPath} ... `);
    const result = await uploadFile(filePath);
    results.push(result);

    if (result.status === 'processed') {
      console.log(`✅ 완료 (${result.chunkCount}개 청크)`);
    } else if (result.status === 'error') {
      console.log(`❌ 실패: ${result.error}`);
    } else {
      console.log(`⚠️  ${result.status}`);
    }
  }

  const success = results.filter((r) => r.status === 'processed').length;
  const failed = results.filter((r) => r.status === 'error').length;

  console.log(
    `\n결과: 성공 ${success}개 / 실패 ${failed}개 / 전체 ${results.length}개`,
  );

  if (failed > 0) {
    console.log('\n실패 항목:');
    results
      .filter((r) => r.status === 'error')
      .forEach((r) => console.log(`  - ${r.fileName}: ${r.error}`));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('예상치 못한 오류:', e);
  process.exit(1);
});
