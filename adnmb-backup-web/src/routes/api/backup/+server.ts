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
import {
	fetchPage,
	fetchPagesInParallel,
	type PageData
} from '../../../lib/services/backup-service';

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
	const firstPageUrl = `${apiBaseUrl}/Api/thread?id=${threadId}&page=1`;
	const cacheDir = path.resolve('cache');
	const cachePath = path.join(cacheDir, `${threadId}.json`);

	try {
		let threadData: PageData;

		if (fs.existsSync(cachePath)) {
			// Incremental backup: read from cache and only fetch new pages
			threadData = await performIncrementalBackup(
				cachePath,
				firstPageUrl,
				headers,
				apiBaseUrl,
				threadId
			);
		} else {
			// Full backup: fetch everything
			threadData = await performFullBackup(firstPageUrl, headers, apiBaseUrl, threadId);
		}

		// Save to cache
		if (!fs.existsSync(cacheDir)) {
			fs.mkdirSync(cacheDir);
		}
		fs.writeFileSync(cachePath, JSON.stringify(threadData, null, 4));

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

// Helper function for incremental backup
async function performIncrementalBackup(
	cachePath: string,
	firstPageUrl: string,
	headers: Record<string, string>,
	apiBaseUrl: string,
	threadId: string
): Promise<PageData> {
	const cachedData = JSON.parse(fs.readFileSync(cachePath, 'utf-8')) as PageData;
	const replyCountInCache = parseInt(cachedData.ReplyCount, 10);
	let pageCountInCache = Math.floor(replyCountInCache / 19);
	if (replyCountInCache % 19 !== 0) {
		pageCountInCache++;
	}

	// Remove the last page from cache to avoid duplication
	const lastPageStartIndex = (pageCountInCache - 1) * 19;
	const cachedReplies = cachedData.Replies.filter((_, index) => index < lastPageStartIndex);

	// Get current thread info
	const firstPageData = await fetchPage(firstPageUrl, headers);
	const currentReplyCount = parseInt(firstPageData.ReplyCount, 10);
	let currentPageCount = Math.floor(currentReplyCount / 19);
	if (currentReplyCount % 19 !== 0) {
		currentPageCount++;
	}

	const allReplies = [...cachedReplies];

	// Only fetch additional pages if there are new ones
	if (currentPageCount >= pageCountInCache) {
		const additionalReplies = await fetchPagesInParallel(
			apiBaseUrl,
			headers,
			threadId,
			pageCountInCache,
			currentPageCount
		);
		allReplies.push(...additionalReplies);
	}

	firstPageData.Replies = allReplies;
	return firstPageData;
}

// Helper function for full backup
async function performFullBackup(
	firstPageUrl: string,
	headers: Record<string, string>,
	apiBaseUrl: string,
	threadId: string
): Promise<PageData> {
	const firstPageData = await fetchPage(firstPageUrl, headers);
	const replyCount = parseInt(firstPageData.ReplyCount, 10);
	let pageCount = Math.floor(replyCount / 19);
	if (replyCount % 19 !== 0) {
		pageCount++;
	}

	const allReplies = [...firstPageData.Replies];

	if (pageCount > 1) {
		const additionalReplies = await fetchPagesInParallel(
			apiBaseUrl,
			headers,
			threadId,
			2,
			pageCount
		);
		allReplies.push(...additionalReplies);
	}

	firstPageData.Replies = allReplies;
	return firstPageData;
}
