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
import { getCookie, getDomainFromUrl } from '../../../lib/utils/config';
import {
	getOrCreateUUID,
	getApiBaseUrl,
	proxyExists,
	fetchFeedData,
	initializeFeed,
	subscribeToFeed
} from '../../../lib/utils/feed-utils';
import { backupThread } from '../../../lib/services/backup-service';

const updateSingleThread = async (
	threadId: string,
	headers: Record<string, string>,
	apiBaseUrl: string
) => {
	try {
		// Use the unified backup function that handles incremental updates
		await backupThread(threadId, apiBaseUrl, headers);

		// Convert to various formats
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
	const hasProxy = proxyExists();

	if (!cookie && !hasProxy) {
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

		const uuid = getOrCreateUUID();

		// 初始化 feed
		const feedInitialized = await initializeFeed(apiBaseUrl, uuid);
		if (!feedInitialized) {
			console.log('Feed 初始化失败，尝试从缓存引导');
		}

		let feedData = await fetchFeedData(apiBaseUrl, uuid, 5);

		if (feedData.length === 0) {
			console.log('Feed 为空，尝试将缓存中的串添加到 feed 中...');

			const files = fs.readdirSync(cacheDir).filter((file) => file.endsWith('.json'));
			const cachedThreadIds = files.map((file) => file.replace('.json', ''));

			if (cachedThreadIds.length > 0) {
				const success = await subscribeToFeed(apiBaseUrl, uuid, cachedThreadIds);

				if (success) {
					feedData = await fetchFeedData(apiBaseUrl, uuid, 5);
				}
			}
		}

		if (feedData.length === 0) {
			return json({ message: 'Feed 好像还是空的，哪里出问题了嘞？' }, { status: 500 });
		}

		console.log(`获取到 ${feedData.length} 个串的 feed 信息`);

		const files = fs.readdirSync(cacheDir);
		const cachedThreads = new Map();

		for (const file of files) {
			if (file.endsWith('.json')) {
				try {
					const filePath = path.join(cacheDir, file);
					const content = fs.readFileSync(filePath, 'utf-8');
					const data = JSON.parse(content);

					const threadId = file.replace('.json', '');
					const cachedReplyCount = parseInt(data.ReplyCount || '0', 10);

					cachedThreads.set(threadId, {
						id: threadId,
						cachedReplyCount,
						title: data.title || '无标题',
						filePath
					});
				} catch (error) {
					console.error(`Error reading cache file ${file}:`, error);
				}
			}
		}

		const results = [];
		let successCount = 0;
		let failCount = 0;
		let skippedCount = 0;
		const newThreadsFound = [];

		for (const feedItem of feedData) {
			const threadId = feedItem.id;
			const currentReplyCount = parseInt(feedItem.reply_count || '0', 10);
			const cachedThread = cachedThreads.get(threadId);

			if (!cachedThread) {
				// 新发现的串
				newThreadsFound.push({
					id: threadId,
					title: feedItem.title || '无标题',
					replyCount: currentReplyCount,
					userHash: feedItem.user_hash
				});
				continue;
			}

			// 检查是否有更新
			if (currentReplyCount > cachedThread.cachedReplyCount) {
				const result = await updateSingleThread(threadId, headers, apiBaseUrl);
				results.push({
					...result,
					oldReplyCount: cachedThread.cachedReplyCount,
					newReplyCount: currentReplyCount,
					title: cachedThread.title
				});

				if (result.success) {
					successCount++;
				} else {
					failCount++;
				}

				await new Promise((resolve) => setTimeout(resolve, 500));
			} else if (currentReplyCount === cachedThread.cachedReplyCount) {
				// 没有更新，跳过
				skippedCount++;
				results.push({
					success: true,
					threadId,
					skipped: true,
					message: '无更新',
					title: cachedThread.title
				});
			} else {
				// 回复数减少了
				const result = await updateSingleThread(threadId, headers, apiBaseUrl);
				results.push({
					...result,
					oldReplyCount: cachedThread.cachedReplyCount,
					newReplyCount: currentReplyCount,
					title: cachedThread.title,
					decreased: true
				});

				if (result.success) {
					successCount++;
				} else {
					failCount++;
				}

				await new Promise((resolve) => setTimeout(resolve, 500));
			}
		}

		return json({
			message: `刷新完成：成功 ${successCount} 个，失败 ${failCount} 个，跳过 ${skippedCount} 个`,
			totalProcessed: feedData.length,
			successCount,
			failCount,
			skippedCount,
			newThreadsFound: newThreadsFound.length > 0 ? newThreadsFound : undefined,
			feedInfo: {
				uuid,
				totalFeedItems: feedData.length
			},
			results
		});
	} catch (error) {
		console.error('Error refreshing all cached threads:', error);
		return json({ message: 'Failed to refresh cached threads' }, { status: 500 });
	}
};
