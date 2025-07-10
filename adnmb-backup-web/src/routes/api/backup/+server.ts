import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import * as fs from 'fs';
import * as path from 'path';
import {
	convertToText,
	convertToTextPoOnly,
	convertToMarkdown,
	convertToMarkdownPoOnly
} from '../../../lib/converter';
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
	const proxyExists = fs.existsSync(path.resolve('proxy.txt'));

	if (!cookie && !proxyExists) {
		return json({ message: 'cookie.txt not found' }, { status: 400 });
	}

	const domain = getDomainFromUrl(apiBaseUrl);
	const headers = createHeaders(domain, cookie);

	try {
		// Use the unified backup function
		await backupThread(threadId, apiBaseUrl, headers);

		// Convert to various formats
		convertToText(threadId);
		convertToTextPoOnly(threadId);
		convertToMarkdown(threadId);
		convertToMarkdownPoOnly(threadId);

		return json({ message: `Backup for thread ${threadId} successful` });
	} catch (error) {
		if (error instanceof Error) {
			return json({ message: error.message }, { status: 500 });
		}
		return json({ message: 'An unknown error occurred' }, { status: 500 });
	}
};
