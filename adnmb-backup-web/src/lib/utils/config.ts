import { config } from 'dotenv';

config();

export const getApiBaseUrl = (): string => {
	// Environment variable takes priority
	const envProxy = process.env.ADNMB_PROXY;
	if (envProxy) {
		const url = envProxy.trim();
		return url.endsWith('/') ? url.slice(0, -1) : url;
	}

	return 'https://api.nmb.best';
};

export function proxyExists(): boolean {
	const apiBaseUrl = getApiBaseUrl();
	return apiBaseUrl !== 'https://api.nmb.best';
}

export const getCookie = (): string | null => {
	// Environment variable takes priority
	const envCookie = process.env.ADNMB_COOKIE;
	if (envCookie) {
		return envCookie.trim();
	}

	return null;
};

export const getDomainFromUrl = (url: string): string => {
	try {
		const uri = new URL(url);
		return uri.hostname;
	} catch {
		return 'api.nmb.best'; // Fallback to default
	}
};

export const createHeaders = (domain: string, cookie: string | null): Record<string, string> => {
	const headers: Record<string, string> = {
		Host: domain,
		Accept: 'application/json',
		'Accept-Encoding': 'gzip',
		'User-Agent':
			'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.0.0 Safari/537.36'
	};

	if (cookie) {
		headers.Cookie = `userhash=${cookie}`;
	}

	return headers;
};
