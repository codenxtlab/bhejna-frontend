import { createHighlighter } from 'shiki';

async function test() {
	try {
		const highlighter = await createHighlighter({
			themes: ['nord'],
			langs: ['curl']
		});
		console.log('Success loading curl');
	} catch (e) {
		console.error('Failed loading curl:', e.message);
	}
}

test();
