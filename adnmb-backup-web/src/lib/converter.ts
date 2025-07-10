import * as fs from 'fs';
import * as path from 'path';

// Thread data types
interface ThreadData {
	id: string;
	user_hash: string;
	now: string;
	title: string;
	name: string;
	content: string;
	img: string;
	ext: string;
	Replies: ReplyData[];
}

interface ReplyData {
	id: string;
	user_hash: string;
	now: string;
	title: string;
	name: string;
	content: string;
	img: string;
	ext: string;
}

// Conversion options
interface ConversionOptions {
	format: 'text' | 'markdown';
	poOnly: boolean;
	threadId: string;
}

// Process content by cleaning HTML tags
const processContent = (content: string, format: 'text' | 'markdown' = 'text'): string => {
	let processed = content
		.replace(/<font color="#789922">&gt;&gt;/g, '>>')
		.replace(/<\/font><br \/>/g, '\n')
		.replace(/<\/font>/g, '\n')
		.replace(/<br \/>\r\n/g, '\n')
		.replace(/<br \/>\n/g, '\n');

	if (format === 'markdown') {
		processed = processed
			.replace(/<b>/g, '**')
			.replace(/<\/b>/g, '**')
			.replace(/<small>/g, '`')
			.replace(/<\/small>/g, '`');
	}

	return processed;
};

// Generate save path for output files
const generateSavePath = (
	threadId: string,
	title: string,
	format: 'text' | 'markdown',
	poOnly: boolean
): string => {
	const ext = format === 'text' ? '.txt' : '.md';
	const suffix = poOnly ? '_po_only' : '';
	const outputDir = path.resolve('output');

	if (!fs.existsSync(outputDir)) {
		fs.mkdirSync(outputDir);
	}

	if (title !== '无标题') {
		let filename = title.replace(/[\\/:*?"<>|]/g, '_');
		if (filename.length > 100) {
			filename = filename.substring(0, 100);
		}
		return path.join(outputDir, `${threadId}_${filename}${suffix}${ext}`);
	}

	return path.join(outputDir, `${threadId}${suffix}${ext}`);
};

// Load PO IDs from file and original poster
const loadPoIds = (threadId: string, originalPosterHash: string): Set<string> => {
	const poPath = path.resolve('po', `${threadId}.txt`);
	const poIds = new Set<string>();
	poIds.add(originalPosterHash);

	if (fs.existsSync(poPath)) {
		const lines = fs.readFileSync(poPath, 'utf-8').split('\n');
		for (const line of lines) {
			const hash = line.split(' ')[0];
			if (hash) {
				poIds.add(hash);
			}
		}
	}

	return poIds;
};

// Format thread header
const formatThreadHeader = (thread: ThreadData, format: 'text' | 'markdown'): string => {
	if (format === 'text') {
		let header = `${thread.user_hash}  ${thread.now}  No.${thread.id}\n\n`;
		if (thread.title !== '无标题') {
			header += `标题:${thread.title}\n`;
		}
		return header;
	} else {
		let header = '';
		if (thread.title !== '无标题') {
			header += `# ${thread.title}\n\n`;
		} else {
			header += `# ${thread.id}\n\n`;
		}
		if (thread.name !== '无名氏' && thread.name !== '') {
			header += `**${thread.name}**\n\n`;
		}
		header += `No.${thread.id}  ${thread.user_hash}  ${thread.now}\n`;
		if (thread.img !== '') {
			const imageBaseUrl = 'https://image.nmb.best/image';
			header += `![image](${imageBaseUrl}/${thread.img}${thread.ext})\n`;
		}
		return header;
	}
};

// Format reply
const formatReply = (reply: ReplyData, format: 'text' | 'markdown', isPo: boolean): string => {
	if (format === 'text') {
		let replyText = `------------------------------------\n`;
		replyText += `${reply.user_hash}  ${reply.now}  No.${reply.id}\n`;
		replyText += `${processContent(reply.content, format)}\n`;
		return replyText;
	} else {
		let replyText = '';
		const headerLevel = isPo ? '##' : '###';

		if (reply.title !== '无标题') {
			replyText += `\n${headerLevel} ${reply.title}\n\n`;
		} else {
			replyText += `\n${headerLevel} No.${reply.id}\n\n`;
		}

		if (reply.name !== '无名氏' && reply.name !== '') {
			replyText += `**${reply.name}**\n`;
		}

		replyText += `${reply.user_hash}  ${reply.now}  No.${reply.id}\n`;

		if (reply.img !== '') {
			const imageBaseUrl = 'https://image.nmb.best/image';
			replyText += `![image](${imageBaseUrl}/${reply.img}${reply.ext})\n`;
		}

		replyText += `${processContent(reply.content, format)}\n`;
		return replyText;
	}
};

// Main conversion function
export const convertThread = (options: ConversionOptions): void => {
	const { format, poOnly, threadId } = options;
	const cachePath = path.resolve('cache', `${threadId}.json`);

	if (!fs.existsSync(cachePath)) {
		throw new Error(`Cache file not found for thread ${threadId}`);
	}

	const threadData: ThreadData = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
	const savePath = generateSavePath(threadId, threadData.title, format, poOnly);

	let content = '';

	// Add thread header and content
	content += formatThreadHeader(threadData, format);
	content += `${processContent(threadData.content, format)}\n`;

	// Process replies
	const poIds = loadPoIds(threadId, threadData.user_hash);

	for (const reply of threadData.Replies) {
		const isPo = poIds.has(reply.user_hash);

		// Skip non-PO replies if poOnly mode is enabled
		if (poOnly && !isPo) {
			continue;
		}

		content += formatReply(reply, format, isPo);
	}

	// no single \n
	content = content.replace(/\n/g, '\n\n');
	// Clean up excessive newlines
	content = content.replace(/\n{3,}/g, '\n\n');

	// Write to file
	fs.writeFileSync(savePath, content, 'utf-8');
};

export const convertToText = (threadId: string): void => {
	convertThread({ format: 'text', poOnly: false, threadId });
};

export const convertToTextPoOnly = (threadId: string): void => {
	convertThread({ format: 'text', poOnly: true, threadId });
};

export const convertToMarkdown = (threadId: string): void => {
	convertThread({ format: 'markdown', poOnly: false, threadId });
};

export const convertToMarkdownPoOnly = (threadId: string): void => {
	convertThread({ format: 'markdown', poOnly: true, threadId });
};
