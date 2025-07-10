import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getOrCreateUUID,
	getApiBaseUrl,
	proxyExists,
	fetchFeedPage,
	fetchFeedData
} from '../../../lib/utils/feed-utils';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const pageParam = url.searchParams.get('page');
		const page = pageParam ? parseInt(pageParam, 10) : 1;

		if (isNaN(page) || page < 1) {
			return json({ error: 'Invalid page parameter' }, { status: 400 });
		}

		const apiBaseUrl = getApiBaseUrl();
		const uuid = getOrCreateUUID();
		const hasProxy = proxyExists();

		const feedData = await fetchFeedPage(apiBaseUrl, uuid, page);

		return json({
			success: true,
			page,
			uuid,
			data: feedData,
			total: feedData.length,
			proxyMode: hasProxy
		});
	} catch (error) {
		console.error('Feed API error:', error);
		return json(
			{
				error: 'Failed to fetch feed data',
				message: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { pages } = await request.json();
		const maxPages = pages && typeof pages === 'number' ? Math.min(pages, 10) : 5; // 限制最大页数

		const apiBaseUrl = getApiBaseUrl();
		const uuid = getOrCreateUUID();
		const hasProxy = proxyExists();

		const allFeedData = await fetchFeedData(apiBaseUrl, uuid, maxPages);

		return json({
			success: true,
			uuid,
			totalPages: maxPages,
			totalThreads: allFeedData.length,
			data: allFeedData,
			proxyMode: hasProxy
		});
	} catch (error) {
		console.error('Feed API error:', error);
		return json(
			{
				error: 'Failed to fetch feed data',
				message: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};
