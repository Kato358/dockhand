import { describe, it, expect } from 'bun:test';
import { pickScanDisplayName } from '../src/lib/server/scanner-output-core';

const DIGEST = 'sha256:' + 'c'.repeat(64);
const BARE = 'a'.repeat(64);

describe('pickScanDisplayName', () => {
	it('keeps a ref that already carries a tag/name (never overrides a real name)', () => {
		expect(pickScanDisplayName('nginx:latest', ['nginx:latest'])).toBe('nginx:latest');
		expect(pickScanDisplayName('registry.io/app:1.2', [])).toBe('registry.io/app:1.2');
		// even if the caller's tag is not in RepoTags, trust what they passed
		expect(pickScanDisplayName('nginx:latest', ['other:tag'])).toBe('nginx:latest');
	});

	it('resolves a bare digest to its RepoTag', () => {
		expect(pickScanDisplayName(DIGEST, ['invoiceninja/invoiceninja:latest']))
			.toBe('invoiceninja/invoiceninja:latest');
		expect(pickScanDisplayName(BARE, ['nginx:1.25'])).toBe('nginx:1.25');
	});

	it('prefers a real tag over a Dockhand temp tag', () => {
		expect(pickScanDisplayName(DIGEST, [
			'invoiceninja/invoiceninja:latest-dockhand-pending',
			'invoiceninja/invoiceninja:latest'
		])).toBe('invoiceninja/invoiceninja:latest');
		// order-independent
		expect(pickScanDisplayName(DIGEST, [
			'app:latest',
			'app:latest-dockhand-update'
		])).toBe('app:latest');
	});

	it('falls back to a temp tag when it is the only tag (still better than a digest)', () => {
		expect(pickScanDisplayName(DIGEST, ['app:latest-dockhand-pending']))
			.toBe('app:latest-dockhand-pending');
	});

	it('falls back to the digest when the image is genuinely untagged', () => {
		expect(pickScanDisplayName(DIGEST, [])).toBe(DIGEST);
		expect(pickScanDisplayName(DIGEST, null)).toBe(DIGEST);
		expect(pickScanDisplayName(DIGEST, undefined)).toBe(DIGEST);
		expect(pickScanDisplayName(DIGEST, ['<none>:<none>'])).toBe(DIGEST);
		expect(pickScanDisplayName(BARE, [])).toBe(BARE); // bare 64-hex, no sha256: prefix
	});
});
