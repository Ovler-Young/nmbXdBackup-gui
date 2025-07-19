import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getApiBaseUrl,
	getCookie,
	getDomainFromUrl,
	createHeaders
} from '../../../lib/utils/config';
import { backupThread } from '../../../lib/services/backup-service';

export const POST: RequestHandler = async ({ request }) => {
	const { threadId } = await request.json();

	if (!threadId) {
		return json({ message: 'Missing threadId' }, { status: 400 });
	}

	const cookie = getCookie();
	const apiBaseUrl = getApiBaseUrl();
	const proxyExists = apiBaseUrl !== 'https://api.nmb.best';

	if (!cookie && !proxyExists) {
		return json({ message: 'Proxy or Cookie should be set' }, { status: 400 });
	}

	const domain = getDomainFromUrl(apiBaseUrl);
	const headers = createHeaders(domain, cookie);

	try {
		// Use the unified backup function with auto conversion enabled
		await backupThread(threadId, apiBaseUrl, headers, 'cache', true);

		return json({ message: `Backup for thread ${threadId} successful` });
	} catch (error) {
		if (error instanceof Error) {
			return json({ message: error.message }, { status: 500 });
		}
		return json({ message: 'An unknown error occurred' }, { status: 500 });
	}
};
