import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import * as fs from 'fs';
import * as path from 'path';

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

					cachedThreads.push({
						id: threadId,
						title,
						replyCount: parseInt(replyCount, 10),
						cachedAt: cachedAt.toISOString(),
						hasImage: !!data.img,
						author: data.user_hash || 'Anonymous'
					});
				} catch (error) {
					console.error(`Error reading cache file ${file}:`, error);
				}
			}
		}

		// Sort by cached date, newest first
		cachedThreads.sort((a, b) => new Date(b.cachedAt).getTime() - new Date(a.cachedAt).getTime());

		return json({ cached: cachedThreads });
	} catch (error) {
		console.error('Error reading cache directory:', error);
		return json({ error: 'Failed to read cached threads' }, { status: 500 });
	}
};
