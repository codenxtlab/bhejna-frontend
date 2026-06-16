import { env } from '$env/dynamic/private';

/**
 * Custom fetch client for Orval
 * Prepends the base URL to all requests.
 */
export const customFetch = async <T>(
	url: string,
	options: RequestInit
): Promise<T> => {
	const baseUrl = (env.BHEJNA_GO_BACKEND_URL || '').replace(/\/$/, '');
	const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`;

	const response = await fetch(fullUrl, options);
	const status = response.status;
	const headers = response.headers;

	let data;
	const contentType = headers.get('content-type');
	if (contentType && contentType.includes('application/json')) {
		data = await response.json();
	} else {
		data = await response.text();
	}

	return { data, status, headers } as T;
};

export default customFetch;
