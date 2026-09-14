import { describe, test, expect } from 'bun:test';
import { releasedEntries } from '../src/lib/utils/changelog-filter';

describe('releasedEntries', () => {
	test('drops coming-soon (unreleased) entries', () => {
		const entries = [
			{ version: '1.0.48', comingSoon: true },
			{ version: '1.0.47' },
			{ version: '1.0.46', comingSoon: false }
		];
		expect(releasedEntries(entries).map((e) => e.version)).toEqual(['1.0.47', '1.0.46']);
	});

	test('keeps everything when nothing is coming-soon', () => {
		const entries = [{ version: '1.0.47' }, { version: '1.0.46' }];
		expect(releasedEntries(entries)).toHaveLength(2);
	});

	test('empty in, empty out', () => {
		expect(releasedEntries([])).toEqual([]);
	});

	test('the top entry being coming-soon does not become the latest released', () => {
		// The regression case: user on an older build, changelog[0] is an unreleased entry.
		const entries = [
			{ version: '1.0.48', comingSoon: true },
			{ version: '1.0.47' }
		];
		expect(releasedEntries(entries)[0].version).toBe('1.0.47');
	});
});
