import fs from 'node:fs';
import path from 'node:path';

const rootDir = path.resolve(new URL('..', import.meta.url).pathname);
const scanDirs = [
  path.join(rootDir, 'src', 'pages'),
  path.join(rootDir, 'src', 'screens'),
];

const bannedPatterns = [
  {
    pattern: /uploadImageToS3|utils\/s3Upload|utils\\s3Upload/,
    reason: 'Stylist app image screens must save DB image data directly, not call S3 upload helpers.',
  },
  {
    pattern: /\/uploads\/image|\/media\/image/,
    reason: 'Stylist app screens must not call upload endpoints for DB-stored images.',
  },
  {
    pattern: /Please Retake.*upload system/i,
    reason: 'Old base64-dependent upload flow must not return.',
  },
];

const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.jsx']);

const listFiles = (dir) => {
  if (!fs.existsSync(dir)) {
    return [];
  }

  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return listFiles(entryPath);
    }
    return sourceExtensions.has(path.extname(entry.name)) ? [entryPath] : [];
  });
};

const failures = [];

for (const filePath of scanDirs.flatMap(listFiles)) {
  const source = fs.readFileSync(filePath, 'utf8');
  const lines = source.split(/\r?\n/);

  for (const { pattern, reason } of bannedPatterns) {
    lines.forEach((line, index) => {
      if (pattern.test(line)) {
        failures.push({
          filePath,
          line: index + 1,
          reason,
          text: line.trim(),
        });
      }
    });
  }
}

if (failures.length > 0) {
  console.error('Image upload regression check failed:\n');
  for (const failure of failures) {
    const relativePath = path.relative(rootDir, failure.filePath);
    console.error(`- ${relativePath}:${failure.line}`);
    console.error(`  ${failure.reason}`);
    console.error(`  ${failure.text}`);
  }
  process.exit(1);
}

console.log('Image upload regression check passed.');
