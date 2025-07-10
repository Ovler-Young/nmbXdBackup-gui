import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { convertThread } from '../../../lib/converter';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { threadId, format, poOnly } = await request.json();

		// Validate input
		if (!threadId) {
			return json({ error: 'Missing threadId' }, { status: 400 });
		}

		if (!format || !['text', 'markdown'].includes(format)) {
			return json({ error: 'Invalid format. Must be "text" or "markdown"' }, { status: 400 });
		}

		// Convert thread to specified format
		convertThread({
			threadId,
			format: format as 'text' | 'markdown',
			poOnly: Boolean(poOnly)
		});

		return json({
			success: true,
			message: `Thread ${threadId} converted to ${format}${poOnly ? ' (PO only)' : ''}`
		});
	} catch (error) {
		console.error('Conversion error:', error);
		return json(
			{
				error: 'Failed to convert thread',
				message: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};
