import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

// UUID 管理
export function generateUUID(): string {
	return uuidv4();
}

export function getOrCreateUUID(): string {
	const uuidPath = path.resolve('uuid.txt');

	if (fs.existsSync(uuidPath)) {
		return fs.readFileSync(uuidPath, 'utf-8').trim();
	}

	const newUUID = generateUUID();
	fs.writeFileSync(uuidPath, newUUID);
	return newUUID;
}

// API 配置工具
export function getApiBaseUrl(): string {
	const proxyPath = path.resolve('proxy.txt');
	if (fs.existsSync(proxyPath)) {
		const url = fs.readFileSync(proxyPath, 'utf-8').trim();
		return url.endsWith('/') ? url.slice(0, -1) : url;
	}
	return 'https://api.nmb.best';
}

export function proxyExists(): boolean {
	return fs.existsSync(path.resolve('proxy.txt'));
}

// Feed 数据类型定义
interface FeedItem {
	id: string;
	user_id: string;
	fid: string;
	reply_count: string;
	recent_replies: string;
	category: string;
	file_id: string;
	img: string;
	ext: string;
	now: string;
	user_hash: string;
	name: string;
	email: string;
	title: string;
	content: string;
	status: string;
	admin: string;
	hide: string;
	po: string;
}

// 获取 feed 数据
export async function fetchFeedPage(
	apiBaseUrl: string,
	uuid: string,
	page: number = 1
): Promise<FeedItem[]> {
	const feedUrl = `${apiBaseUrl}/Api/feed?uuid=${uuid}&page=${page}`;
	const headers = {
		'User-Agent':
			'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.0.0 Safari/537.36',
		Accept: 'application/json',
		'Accept-Encoding': 'gzip'
	};

	const response = await fetch(feedUrl, { headers });

	if (!response.ok) {
		throw new Error(`Failed to fetch feed page ${page}: ${response.status} ${response.statusText}`);
	}

	const data = await response.json();
	return Array.isArray(data) ? data : [];
}

export async function fetchFeedData(
	apiBaseUrl: string,
	uuid: string,
	maxPages: number = 5
): Promise<FeedItem[]> {
	const allFeedData: FeedItem[] = [];
	const hasProxy = proxyExists();

	for (let page = 1; page <= maxPages; page++) {
		try {
			const feedData = await fetchFeedPage(apiBaseUrl, uuid, page);

			if (feedData.length === 0) {
				break;
			}

			allFeedData.push(...feedData);

			// 如果没有代理才需要添加延迟避免请求过频
			if (page < maxPages && !hasProxy) {
				await new Promise((resolve) => setTimeout(resolve, 300));
			}
		} catch (error) {
			console.error(`Error fetching feed page ${page}:`, error);
			break;
		}
	}

	return allFeedData;
}

// 订阅串到 feed
export async function subscribeToFeed(
	apiBaseUrl: string,
	uuid: string,
	threadIds: string[]
): Promise<boolean> {
	console.log(`正在将 ${threadIds.length} 个串订阅到 Feed...`);
	const hasProxy = proxyExists();
	let successCount = 0;

	for (const threadId of threadIds) {
		try {
			const addFeedUrl = `${apiBaseUrl}/Api/addFeed?uuid=${uuid}&tid=${threadId}`;
			const response = await fetch(addFeedUrl, {
				method: 'GET',
				headers: {
					'User-Agent':
						'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.0.0 Safari/537.36'
				}
			});

			if (response.ok) {
				const result = await response.json();
				if (result === '订阅大成功→_→') {
					successCount++;
				}
			}

			// 如果没有代理才需要添加延迟避免请求过频
			if (!hasProxy) {
				await new Promise((resolve) => setTimeout(resolve, 300));
			}
		} catch (error) {
			console.error(`订阅串 ${threadId} 失败:`, error);
		}
	}

	console.log(`Feed 订阅完成: ${successCount}/${threadIds.length} 成功`);
	return successCount > 0;
}

// 初始化 feed，确保能获取到 feed 数据
export async function initializeFeed(apiBaseUrl: string, uuid: string): Promise<boolean> {
	try {
		const firstPageData = await fetchFeedPage(apiBaseUrl, uuid, 1);
		return firstPageData.length > 0;
	} catch (error) {
		console.error('Feed 初始化失败:', error);
		return false;
	}
}
