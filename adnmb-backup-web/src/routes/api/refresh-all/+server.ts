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

// Function to normalize time format to ISO 8601
function normalizeTimeFormat(timeValue: string | number | Date | null | undefined): string {
	if (!timeValue) {
		return new Date().toISOString();
	}

	// If it's already a valid Date object or ISO string, return ISO format
	try {
		const date = new Date(timeValue);
		if (!isNaN(date.getTime())) {
			return date.toISOString();
		}
	} catch {
		// Fall through to timestamp handling
	}

	// Try to handle as Unix timestamp (seconds or milliseconds)
	if (typeof timeValue === 'number' || typeof timeValue === 'string') {
		const numValue = typeof timeValue === 'string' ? parseInt(timeValue, 10) : timeValue;

		if (!isNaN(numValue)) {
			// If it looks like a Unix timestamp in seconds (less than year 2100)
			if (numValue < 4102444800) {
				return new Date(numValue * 1000).toISOString();
			}
			// If it looks like a Unix timestamp in milliseconds
			else if (numValue > 1000000000000) {
				return new Date(numValue).toISOString();
			}
		}
	}

	// If all else fails, return current time
	console.warn(`Unable to parse time value: ${timeValue}, using current time`);
	return new Date().toISOString();
}

const proxyPath = path.resolve('proxy.txt');
const proxyExists = fs.existsSync(proxyPath);

const getApiBaseUrl = () => {
	if (proxyExists) {
		const url = fs.readFileSync(proxyPath, 'utf-8').trim();
		return url.endsWith('/') ? url.slice(0, -1) : url;
	}
	return 'https://api.nmb.best';
};

const getCookie = () => {
	const cookiePath = path.resolve('cookie.txt');
	if (fs.existsSync(cookiePath)) {
		return fs.readFileSync(cookiePath, 'utf-8').trim();
	}
	return null;
};

const getDomainFromUrl = (url: string) => {
	try {
		const uri = new URL(url);
		return uri.hostname;
	} catch {
		return 'api.nmb.best'; // Fallback to default
	}
};

const fetchPage = async (url: string, headers: Record<string, string>) => {
	const response = await fetch(url, { headers });
	return response.json();
};

const updateSingleThread = async (
	threadId: string,
	headers: Record<string, string>,
	apiBaseUrl: string
) => {
	const firstPageUrl = `${apiBaseUrl}/Api/thread?id=${threadId}&page=1`;

	try {
		const firstPageData = await fetchPage(firstPageUrl, headers);
		const replyCount = parseInt(firstPageData.ReplyCount, 10);
		let pageCount = Math.floor(replyCount / 19);
		if (replyCount % 19 !== 0) {
			pageCount++;
		}

		const allReplies = [...firstPageData.Replies];

		if (pageCount > 1) {
			const pagePromises = [];
			for (let page = 2; page <= pageCount; page++) {
				const pageUrl = `${apiBaseUrl}/Api/thread?id=${threadId}&page=${page}`;
				pagePromises.push(fetchPage(pageUrl, headers));
			}
			const subsequentPagesData = await Promise.all(pagePromises);
			for (const pageData of subsequentPagesData) {
				allReplies.push(...pageData.Replies);
			}
		}

		firstPageData.Replies = allReplies;

		const cacheDir = path.resolve('cache');
		if (!fs.existsSync(cacheDir)) {
			fs.mkdirSync(cacheDir);
		}

		const cachePath = path.join(cacheDir, `${threadId}.json`);
		fs.writeFileSync(cachePath, JSON.stringify(firstPageData, null, 4));

		convertToText(threadId);
		convertToTextPoOnly(threadId);
		convertToMarkdown(threadId);
		convertToMarkdownPoOnly(threadId);

		return { success: true, threadId };
	} catch (error) {
		return {
			success: false,
			threadId,
			error: error instanceof Error ? error.message : 'Unknown error'
		};
	}
};

export const POST: RequestHandler = async () => {
	const cookie = getCookie();
	if (!cookie && !proxyExists) {
		return json({ message: 'cookie.txt not found' }, { status: 400 });
	}

	const apiBaseUrl = getApiBaseUrl();
	const domain = getDomainFromUrl(apiBaseUrl);

	const headers = {
		Host: domain,
		Accept: 'application/json',
		'Accept-Encoding': 'gzip',
		'User-Agent':
			'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.0.0 Safari/537.36',
		Cookie: `userhash=${cookie}`
	};

	try {
		const cacheDir = path.resolve('cache');

		if (!fs.existsSync(cacheDir)) {
			return json({ message: 'No cache directory found' }, { status: 404 });
		}

		const files = fs.readdirSync(cacheDir);
		const cachedThreads = [];

		// Get all cached threads with their last reply times
		for (const file of files) {
			if (file.endsWith('.json')) {
				try {
					const filePath = path.join(cacheDir, file);
					const content = fs.readFileSync(filePath, 'utf-8');
					const data = JSON.parse(content);

					const threadId = file.replace('.json', '');

					// Get the last reply time for sorting by latest update
					let lastReplyTime = data.now; // Original post time
					if (data.Replies && data.Replies.length > 0) {
						// Get the time of the last reply
						const lastReply = data.Replies[data.Replies.length - 1];
						lastReplyTime = lastReply.now;
					}

					cachedThreads.push({
						id: threadId,
						lastReplyTime: normalizeTimeFormat(lastReplyTime)
					});
				} catch (error) {
					console.error(`Error reading cache file ${file}:`, error);
				}
			}
		}

		// Sort by last reply time, newest first
		cachedThreads.sort(
			(a, b) => new Date(b.lastReplyTime).getTime() - new Date(a.lastReplyTime).getTime()
		);

		const results = [];
		let successCount = 0;
		let failCount = 0;

		// Update each thread one by one in order
		for (const thread of cachedThreads) {
			const result = await updateSingleThread(thread.id, headers, apiBaseUrl);
			results.push(result);

			if (result.success) {
				successCount++;
			} else {
				failCount++;
			}

			// Add a small delay to avoid overwhelming the API
			await new Promise((resolve) => setTimeout(resolve, 500));
		}

		return json({
			message: `刷新完成：成功 ${successCount} 个，失败 ${failCount} 个`,
			totalProcessed: cachedThreads.length,
			successCount,
			failCount,
			results
		});
	} catch (error) {
		console.error('Error refreshing all cached threads:', error);
		return json({ message: 'Failed to refresh cached threads' }, { status: 500 });
	}
};
