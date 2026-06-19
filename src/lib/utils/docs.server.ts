import { createHighlighter } from 'shiki';
import { langMap, supportedLangs } from './docs.ts';

let highlighter: any;

/**
 * Get or create the Shiki highlighter instance
 */
export async function getHighlighter() {
	if (!highlighter) {
		highlighter = await createHighlighter({
			themes: ['nord'],
			langs: supportedLangs
		});
	}
	return highlighter;
}

/**
 * Highlight code using centralized configuration
 */
export async function highlight(code: string, lang: string = 'text') {
	const h = await getHighlighter();
	const shikiLang = langMap[lang.toLowerCase()] || lang.toLowerCase();

	try {
		return h.codeToHtml(code, {
			lang: supportedLangs.includes(shikiLang) ? shikiLang : 'text',
			theme: 'nord'
		});
	} catch (e) {
		console.error(`Highlighting failed for lang: ${lang}`, e);
		return h.codeToHtml(code, { lang: 'text', theme: 'nord' });
	}
}
