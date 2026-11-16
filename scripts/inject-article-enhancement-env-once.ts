#!/usr/bin/env -S pnpm tsx
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const DEFAULT_PROVIDER = 'gemini';
const DEFAULT_MODEL = 'gemini-1.5-flash';

function loadGeminiKeyFromEnv(): string {
  const value = String(process.env.INJECT_GEMINI_API_KEY || '').trim();
  if (!value) {
    console.error(
      'FATAL: INJECT_GEMINI_API_KEY env var is empty. Set it as an encrypted repo secret passed into the maintenance runner env.',
    );
    process.exit(2);
  }

  if (value.length < 24 || /\s/.test(value)) {
    console.error('FATAL: INJECT_GEMINI_API_KEY looks invalid. Refusing to write.');
    process.exit(3);
  }

  return value;
}

function upsertEnvLine(lines: string[], key: string, value: string): string[] {
  const filtered = lines.filter((line) => !line.startsWith(`${key}=`));
  filtered.push(`${key}=${value}`);
  return filtered;
}

function main() {
  const envFile = resolve(process.cwd(), '.env.local');
  const envDir = dirname(envFile);

  if (!existsSync(envDir)) mkdirSync(envDir, { recursive: true });
  if (!existsSync(envFile)) writeFileSync(envFile, '', { mode: 0o660 });

  const raw = readFileSync(envFile, 'utf-8');
  const geminiKey = loadGeminiKeyFromEnv();
  const provider = String(process.env.INJECT_ARTICLE_ENHANCEMENT_PROVIDER || DEFAULT_PROVIDER).trim() || DEFAULT_PROVIDER;
  const model = String(process.env.INJECT_GEMINI_ARTICLE_ENHANCEMENT_MODEL || DEFAULT_MODEL).trim() || DEFAULT_MODEL;

  let lines = raw.split(/\r?\n/).filter((line, index, all) => !(index === all.length - 1 && line === ''));
  lines = upsertEnvLine(lines, 'ARTICLE_ENHANCEMENT_PROVIDER', provider);
  lines = upsertEnvLine(lines, 'GEMINI_API_KEY', geminiKey);
  lines = upsertEnvLine(lines, 'GEMINI_ARTICLE_ENHANCEMENT_MODEL', model);

  const newContent = `${lines.join('\n')}\n`;
  const tmp = `${envFile}.tmp.${process.pid}`;
  writeFileSync(tmp, newContent, { mode: 0o660 });
  renameSync(tmp, envFile);

  const after = readFileSync(envFile, 'utf-8');
  const providerMatch = after.match(/^ARTICLE_ENHANCEMENT_PROVIDER=(.+)$/m);
  const keyMatch = after.match(/^GEMINI_API_KEY=(.+)$/m);
  const modelMatch = after.match(/^GEMINI_ARTICLE_ENHANCEMENT_MODEL=(.+)$/m);

  if (!providerMatch || !keyMatch || !modelMatch) {
    console.error('FATAL: post-write verification failed for article enhancement env.');
    process.exit(4);
  }

  console.log(
    `Wrote .env.local: ${envFile} | provider=${providerMatch[1]} | model=${modelMatch[1]} | gemini_key_len=${keyMatch[1].length}`,
  );
}

main();
