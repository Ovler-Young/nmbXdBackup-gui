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

		// Read file content
		const fileContent = fs.readFileSync(outputPath, 'utf-8');

		// Escape HTML characters for text format
		const escapedContent =
			format === 'text'
				? fileContent
						.replace(/&/g, '&amp;')
						.replace(/</g, '&lt;')
						.replace(/>/g, '&gt;')
						.replace(/"/g, '&quot;')
						.replace(/'/g, '&#39;')
				: fileContent;

		// Generate HTML response
		const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>${title} - ${threadId}</title>
	<style>
		body {
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
			line-height: 1.6;
			max-width: 800px;
			margin: 0 auto;
			padding: 20px;
			background-color: #f5f5f5;
		}
		.container {
			background-color: white;
			padding: 30px;
			border-radius: 8px;
			box-shadow: 0 2px 10px rgba(0,0,0,0.1);
		}
		.header {
			border-bottom: 2px solid #eee;
			padding-bottom: 20px;
			margin-bottom: 30px;
		}
		.title {
			color: #333;
			margin: 0 0 10px 0;
			font-size: 24px;
		}
		.meta {
			color: #666;
			font-size: 14px;
		}
		.content {
			white-space: pre-wrap;
			word-wrap: break-word;
			font-size: 16px;
			line-height: 1.8;
		}
		.download-btn {
			position: fixed;
			top: 20px;
			right: 20px;
			background-color: #007AFF;
			color: white;
			border: none;
			border-radius: 6px;
			padding: 10px 20px;
			text-decoration: none;
			font-size: 14px;
			box-shadow: 0 2px 6px rgba(0,122,255,0.3);
		}
		.download-btn:hover {
			background-color: #0056CC;
		}
		@media (max-width: 600px) {
			body { padding: 10px; }
			.container { padding: 20px; }
			.download-btn { position: static; display: block; text-align: center; margin-bottom: 20px; }
		}
	</style>
</head>
<body>
	<a href="/api/download-file?threadId=${encodeURIComponent(threadId)}&format=${encodeURIComponent(format)}&mode=${encodeURIComponent(mode)}" class="download-btn">下载文件</a>
	<div class="container">
		<div class="header">
			<h1 class="title">${title}</h1>
			<div class="meta">
				线程ID: ${threadId} | 格式: ${format} | 模式: ${mode === 'po' ? 'PO only' : '全部'}
			</div>
		</div>
		<div class="content">${escapedContent}</div>
	</div>
	<script>
		function markdownToHtml(markdown) {
			// Basic markdown conversion for preview
			return markdown
				.replace(/^# (.*$)/gim, '<h1>$1</h1>')
				.replace(/^## (.*$)/gim, '<h2>$1</h2>')
				.replace(/^### (.*$)/gim, '<h3>$1</h3>')
				.replace(/\\*\\*(.*?)\\*\\*/g, '<strong>$1</strong>')
				.replace(/\\*(.*?)\\*/g, '<em>$1</em>')
				.replace(/\`(.*?)\`/g, '<code>$1</code>')
				.replace(/!\\[.*?\\]\\((.*?)\\)/g, '<img src="$1" style="max-width: 100%; height: auto;">')
				.replace(/\\n/g, '<br>');
		}
		
		${
			format === 'markdown'
				? `
		// Apply markdown conversion if format is markdown
		const contentDiv = document.querySelector('.content');
		contentDiv.innerHTML = markdownToHtml(contentDiv.textContent);
		`
				: ''
		}
	</script>
</body>
</html>`;

		return new Response(html, {
			headers: {
				'Content-Type': 'text/html; charset=utf-8',
				'Cache-Control': 'public, max-age=3600'
			}
		});
	} catch (err) {
		console.error('Preview error:', err);
		if (err instanceof Error && 'status' in err) {
			throw err;
		}
		throw error(500, 'Internal server error');
	}
};
