import { Semaphore } from '../utils/semaphore';
import * as fs from 'fs';
import * as path from 'path';

export interface Reply {
	user_hash: string;
	[key: string]: unknown;
}

export interface PageData {
	Replies: Reply[];
	ReplyCount: string;
	[key: string]: unknown;
}

// Fetch a single page from the API
export const fetchPage = async (
	url: string,
	headers: Record<string, string>
): Promise<PageData> => {
	const response = await fetch(url, { headers });
	return response.json() as Promise<PageData>;
};

// Fetch multiple pages with concurrency limit
export const fetchPagesInParallel = async (
	apiBaseUrl: string,
	headers: Record<string, string>,
	threadId: string,
	startPage: number,
	endPage: number
): Promise<Reply[]> => {
	const semaphore = new Semaphore(16); // Limit to 16 concurrent requests

	const fetchPromises: Promise<{ page: number; replies: Reply[] }>[] = [];

	for (let page = startPage; page <= endPage; page++) {
		const fetchPromise = (async (pageNum: number) => {
			await semaphore.acquire();
			try {
				const pageUrl = `${apiBaseUrl}/Api/thread?id=${threadId}&page=${pageNum}`;
				const pageData = await fetchPage(pageUrl, headers);
				const replies = pageData.Replies || [];

				// Filter out "Tips" entries
				const filteredReplies = replies.filter((reply: Reply) => reply.user_hash !== 'Tips');

				return { page: pageNum, replies: filteredReplies };
			} finally {
				semaphore.release();
			}
		})(page);

		fetchPromises.push(fetchPromise);
	}

	const pageResults = await Promise.all(fetchPromises);

	pageResults.sort((a, b) => a.page - b.page);

	// Flatten all replies in order
	const allReplies: Reply[] = [];
	for (const result of pageResults) {
		allReplies.push(...result.replies);
	}

	return allReplies;
};

// Calculate page count from reply count
export const calculatePageCount = (replyCount: number): number => {
	let pageCount = Math.floor(replyCount / 19);
	if (replyCount % 19 !== 0) {
		pageCount++;
	}
	return pageCount;
};

// Perform incremental backup using cache
export const performIncrementalBackup = async (
	threadId: string,
	cachePath: string,
	firstPageUrl: string,
	headers: Record<string, string>,
	apiBaseUrl: string
): Promise<PageData> => {
	// Read cached data
	const cachedData = JSON.parse(fs.readFileSync(cachePath, 'utf-8')) as PageData;
	const replyCountInCache = parseInt(cachedData.ReplyCount, 10);
	const pageCountInCache = calculatePageCount(replyCountInCache);

	// Remove the last page from cache to avoid duplication
	const lastPageStartIndex = (pageCountInCache - 1) * 19;
	const cachedReplies = cachedData.Replies.filter((_, index) => index < lastPageStartIndex);

	// Get current thread info
	const firstPageData = await fetchPage(firstPageUrl, headers);
	const currentReplyCount = parseInt(firstPageData.ReplyCount, 10);
	const currentPageCount = calculatePageCount(currentReplyCount);

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
};

// Perform full backup from scratch
export const performFullBackup = async (
	threadId: string,
	firstPageUrl: string,
	headers: Record<string, string>,
	apiBaseUrl: string
): Promise<PageData> => {
	const firstPageData = await fetchPage(firstPageUrl, headers);
	const replyCount = parseInt(firstPageData.ReplyCount, 10);
	const pageCount = calculatePageCount(replyCount);

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
};

// Unified backup function that handles both incremental and full backup
export const backupThread = async (
	threadId: string,
	apiBaseUrl: string,
	headers: Record<string, string>,
	cacheDir: string = 'cache'
): Promise<PageData> => {
	const cachePath = path.join(path.resolve(cacheDir), `${threadId}.json`);
	const firstPageUrl = `${apiBaseUrl}/Api/thread?id=${threadId}&page=1`;

	let threadData: PageData;

	if (fs.existsSync(cachePath)) {
		// Incremental backup: read from cache and only fetch new pages
		threadData = await performIncrementalBackup(
			threadId,
			cachePath,
			firstPageUrl,
			headers,
			apiBaseUrl
		);
	} else {
		// Full backup: fetch everything
		threadData = await performFullBackup(threadId, firstPageUrl, headers, apiBaseUrl);
	}

	// Save to cache
	if (!fs.existsSync(path.resolve(cacheDir))) {
		fs.mkdirSync(path.resolve(cacheDir));
	}
	fs.writeFileSync(cachePath, JSON.stringify(threadData, null, 4));

	return threadData;
};
