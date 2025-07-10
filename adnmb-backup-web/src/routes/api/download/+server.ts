import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import * as fs from 'fs';
import * as path from 'path';
import { convertThread } from '../../../lib/converter';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { threadId, format, mode } = await request.json();

		if (!threadId || !format || !mode) {
			return json(
				{
					error: 'Missing required parameters: threadId, format (text|markdown), mode (all|po)'
				},
				{ status: 400 }
			);
		}

		// Validate parameters
		if (!['text', 'markdown'].includes(format)) {
			return json({ error: 'Invalid format. Must be "text" or "markdown"' }, { status: 400 });
		}

		if (!['all', 'po'].includes(mode)) {
			return json({ error: 'Invalid mode. Must be "all" or "po"' }, { status: 400 });
		}

		// Check if thread is cached
		const cachePath = path.resolve('cache', `${threadId}.json`);
		if (!fs.existsSync(cachePath)) {
			return json({ error: `Thread ${threadId} is not cached` }, { status: 404 });
		}

		// Get thread data to determine filename
		const threadData = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
		const title = threadData.title || '无标题';

		// Determine file extension and suffix
		const ext = format === 'text' ? '.txt' : '.md';
		const suffix = mode === 'po' ? '_po_only' : '';

		// Generate filename
		let filename = title !== '无标题' ? title.replace(/[\\/:*?"<>|]/g, '_') : threadId;
		if (filename.length > 100) {
			filename = filename.substring(0, 100);
		}
		filename = `${threadId}_${filename}${suffix}${ext}`;

		// Find the output file
		const outputPath = path.resolve('output', filename);

		if (!fs.existsSync(outputPath)) {
			// File doesn't exist, generate it using the new converter
			try {
				convertThread({
					threadId,
					format: format as 'text' | 'markdown',
					poOnly: mode === 'po'
				});

				// Check if file was created
				if (!fs.existsSync(outputPath)) {
					return json({ error: 'Failed to generate file' }, { status: 500 });
				}
			} catch (error) {
				console.error('Error generating file:', error);
				return json({ error: 'Failed to generate file' }, { status: 500 });
			}
		}

		// Read and return file content
		const fileContent = fs.readFileSync(outputPath, 'utf-8');

		return json({
			success: true,
			filename,
			content: fileContent,
			size: fileContent.length,
			threadId,
			title,
			format,
			mode
		});
	} catch (error) {
		console.error('Download error:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
