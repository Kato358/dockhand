#!/usr/bin/env node
// Apply zh-CN translations over the Svelte UI sources.
//
// The dictionary is l10n/zh-CN.json: { "exact English string": "中文" }.
// Two exact-match replacement modes, both case- and whitespace-sensitive:
//   1. Quoted literals:  "Containers"  'Containers'  `Containers`
//      (covers attribute values like title="Stop" and string props/labels)
//   2. Markup text nodes: >Containers<  (with optional surrounding whitespace)
//
// Only *.svelte files are touched — server code and API contracts live in
// *.ts/*.js and must keep their original strings. Every match replaces the
// WHOLE literal/text node, so keys are never applied as substrings, and the
// script is idempotent: once translated, English keys are simply not found.
//
// Usage: node l10n/apply.mjs [--dry-run]
// Exit code is always 0; unmatched keys are reported as "stale" so the CI
// log shows which dictionary entries no longer fit the upstream sources.

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DRY_RUN = process.argv.includes('--dry-run');
const SKIP_DIRS = new Set(['node_modules', 'build', '.svelte-kit', '.git']);
const EXTENSIONS = new Set(['.svelte']);

const dict = JSON.parse(readFileSync(join(ROOT, 'l10n', 'zh-CN.json'), 'utf8'));
const keys = Object.keys(dict).sort((a, b) => b.length - a.length);

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const literalRes = keys.map((k) => new RegExp(`(['"\`])${escapeRe(k)}\\1`, 'g'));
const textRes = keys.map((k) => new RegExp(`(>)\\s*${escapeRe(k)}\\s*(<)`, 'g'));

const hits = new Map(keys.map((k) => [k, 0]));
const filesTouched = new Set();

function* walk(dir) {
	for (const name of readdirSync(dir)) {
		if (SKIP_DIRS.has(name)) continue;
		const full = join(dir, name);
		if (statSync(full).isDirectory()) yield* walk(full);
		else if (EXTENSIONS.has(extname(name))) yield full;
	}
}

let replacements = 0;
for (const file of walk(join(ROOT, 'src'))) {
	const original = readFileSync(file, 'utf8');
	let content = original;

	keys.forEach((key, i) => {
		let n = 0;
		content = content.replace(literalRes[i], (m, q) => {
			n++;
			return `${q}${dict[key]}${q}`;
		});
		content = content.replace(textRes[i], (m, open, close) => {
			n++;
			return `${open}${dict[key]}${close}`;
		});
		if (n > 0) {
			hits.set(key, hits.get(key) + n);
			replacements += n;
		}
	});

	if (content !== original) {
		filesTouched.add(file);
		if (!DRY_RUN) writeFileSync(file, content);
	}
}

const stale = keys.filter((k) => hits.get(k) === 0);
console.log(`l10n: ${replacements} replacement(s) in ${filesTouched.size} file(s)${DRY_RUN ? ' (dry run)' : ''}`);
console.log(`l10n: ${keys.length - stale.length}/${keys.length} dictionary entries used`);

if (stale.length > 0) {
	console.log(`l10n: ${stale.length} stale entr${stale.length === 1 ? 'y' : 'ies'} (no match in sources, safe to keep or remove):`);
	for (const k of stale) console.log(`  - ${JSON.stringify(k)}`);
}
if (process.env.GITHUB_STEP_SUMMARY) {
	const lines = [
		`### 汉化结果`,
		`- 替换：**${replacements}** 处（${filesTouched.size} 个文件）`,
		`- 词典命中：**${keys.length - stale.length}/${keys.length}**`,
	];
	if (stale.length > 0) lines.push(`- 未命中（上游可能已改动文案）：${stale.map((k) => `\`${k}\``).join(', ')}`);
	writeFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join('\n') + '\n', { flag: 'a' });
}
