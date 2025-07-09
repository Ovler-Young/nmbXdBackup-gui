import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import * as fs from 'fs';
import * as path from 'path';

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

export const GET: RequestHandler = async () => {
	try {
		const cacheDir = path.resolve('cache');

		if (!fs.existsSync(cacheDir)) {
			return json({ cached: [] });
		}

		const files = fs.readdirSync(cacheDir);
		const cachedThreads = [];

		for (const file of files) {
			if (file.endsWith('.json')) {
				try {
					const filePath = path.join(cacheDir, file);
					const content = fs.readFileSync(filePath, 'utf-8');
					const data = JSON.parse(content);

					const threadId = file.replace('.json', '');
					const title = data.title || '无标题';
					const replyCount = data.ReplyCount || 0;
					const cachedAt = fs.statSync(filePath).mtime;

					// Get the last reply time for sorting by latest update
					let lastReplyTime = data.now; // Original post time
					if (data.Replies && data.Replies.length > 0) {
						// Get the time of the last reply
						const lastReply = data.Replies[data.Replies.length - 1];
						lastReplyTime = lastReply.now;
					}

					// Normalize the time format to ISO 8601
					const normalizedLastReplyTime = normalizeTimeFormat(lastReplyTime);

					cachedThreads.push({
						id: threadId,
						title,
						replyCount: parseInt(replyCount, 10),
						cachedAt: cachedAt.toISOString(),
						lastReplyTime: normalizedLastReplyTime,
						hasImage: !!data.img,
						author: data.user_hash || 'Anonymous'
					});
				} catch (error) {
					console.error(`Error reading cache file ${file}:`, error);
				}
			}
		}

		// Sort by last reply time, newest first (default sorting)
		cachedThreads.sort(
			(a, b) => new Date(b.lastReplyTime).getTime() - new Date(a.lastReplyTime).getTime()
		);

		return json({ cached: cachedThreads });
	} catch (error) {
		console.error('Error reading cache directory:', error);
		return json({ error: 'Failed to read cached threads' }, { status: 500 });
	}
};
