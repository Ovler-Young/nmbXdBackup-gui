import { Semaphore } from '../utils/semaphore';

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
