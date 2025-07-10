import type { RequestHandler } from './$types';
import * as fs from 'fs';
import * as path from 'path';
import { convertThread } from '../../../lib/converter';
import { error } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const threadId = url.searchParams.get('threadId');
		const format = url.searchParams.get('format');
		const mode = url.searchParams.get('mode');

		if (!threadId || !format || !mode) {
			throw error(400, 'Missing required parameters: threadId, format, mode');
		}

		// Validate parameters
		if (!['text', 'markdown'].includes(format)) {
			throw error(400, 'Invalid format. Must be "text" or "markdown"');
		}

		if (!['all', 'po'].includes(mode)) {
			throw error(400, 'Invalid mode. Must be "all" or "po"');
		}

		// Check if thread is cached
		const cachePath = path.resolve('cache', `${threadId}.json`);
		if (!fs.existsSync(cachePath)) {
			throw error(404, `Thread ${threadId} is not cached`);
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
					throw error(500, 'Failed to generate file');
				}
			} catch (err) {
				console.error('Error generating file:', err);
				throw error(500, 'Failed to generate file');
			}
		}

		// Read file content and add UTF-8 BOM
		const fileContent = fs.readFileSync(outputPath, 'utf-8');
		const utf8BOM = '\uFEFF'; // UTF-8 BOM
		const contentWithBOM = utf8BOM + fileContent;

		// Convert to buffer with explicit UTF-8 encoding
		const contentBuffer = Buffer.from(contentWithBOM, 'utf-8');

		// Determine content type
		const contentType =
			format === 'markdown' ? 'text/markdown; charset=utf-8' : 'text/plain; charset=utf-8';

		// Return file directly with proper headers for download
		return new Response(contentBuffer, {
			headers: {
				'Content-Type': contentType,
				'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
				'Content-Length': contentBuffer.length.toString(),
				'Cache-Control': 'public, max-age=3600',
				'Accept-Ranges': 'bytes',
				'X-Content-Type-Options': 'nosniff'
			}
		});
	} catch (err) {
		console.error('Download file error:', err);
		if (err instanceof Error && 'status' in err) {
			throw err;
		}
		throw error(500, 'Internal server error');
	}
};
