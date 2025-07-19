/**
 * Time formatting utilities
 */

/**
 * Normalize time format to ISO 8601
 * Handles various time formats including Unix timestamps, Date objects, and ISO strings
 */
export function normalizeTimeFormat(timeValue: string | number | Date | null | undefined): string {
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

/**
 * Format time for display in the frontend
 * Handles both Chinese format (with day of week) and ISO strings
 */
export function formatDisplayTime(timeString: string): string {
	if (!timeString) return '未知时间';

	// If it's already in Chinese format like "2025-07-05(六)18:09:57", keep it as is
	if (timeString.includes('(') && timeString.includes(')')) {
		return timeString;
	}

	// Otherwise format as Chinese locale string
	try {
		return new Date(timeString).toLocaleString('zh-CN');
	} catch {
		return timeString; // Fallback to original string if parsing fails
	}
}
