import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import * as fs from 'fs';
import * as path from 'path';
import zlib from 'zlib';
import { promisify } from 'util';
import { Buffer } from 'buffer';
import { convertToText, convertToTextPoOnly, convertToMarkdown, convertToMarkdownPoOnly } from '../../../lib/converter';

const gunzip = promisify(zlib.gunzip);

const proxyPath = path.resolve('proxy.txt');
const proxyExists = fs.existsSync(proxyPath);

const getApiBaseUrl = () => {
    if (proxyExists) {
        const url = fs.readFileSync(proxyPath, 'utf-8').trim();
        return url.endsWith('/') ? url.slice(0, -1) : url;
    }
    return 'https://api.nmb.best';
};

const getCookie = () => {
    const cookiePath = path.resolve('cookie.txt');
    if (fs.existsSync(cookiePath)) {
        return fs.readFileSync(cookiePath, 'utf-8').trim();
    }
    return null;
};

const getDomainFromUrl = (url: string) => {
    try {
        const uri = new URL(url);
        return uri.hostname;
    } catch {
        return 'api.nmb.best'; // Fallback to default
    }
}

const fetchPage = async (url: string, headers: Record<string, string>) => {
    const response = await fetch(url, { headers });
    const buffer = await response.arrayBuffer();
    const decompressed = await gunzip(Buffer.from(buffer));
    return JSON.parse(decompressed.toString());
}

export const POST: RequestHandler = async ({ request }) => {
	const { threadId } = await request.json();

	if (!threadId) {
		return json({ message: 'Missing threadId' }, { status: 400 });
	}

    const cookie = getCookie();
    if (!cookie && !proxyExists) {
        return json({ message: 'cookie.txt not found' }, { status: 400 });
    }

    const apiBaseUrl = getApiBaseUrl();
    const domain = getDomainFromUrl(apiBaseUrl);

    const headers = {
        'Host': domain,
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.0.0 Safari/537.36',
        'Cookie': `userhash=${cookie}`
    };

    const firstPageUrl = `${apiBaseUrl}/Api/thread?id=${threadId}&page=1`;

    try {
        const firstPageData = await fetchPage(firstPageUrl, headers);
        const replyCount = parseInt(firstPageData.ReplyCount, 10);
        let pageCount = Math.floor(replyCount / 19);
        if (replyCount % 19 !== 0) {
            pageCount++;
        }

        const allReplies = [...firstPageData.Replies];

        if (pageCount > 1) {
            const pagePromises = [];
            for (let page = 2; page <= pageCount; page++) {
                const pageUrl = `${apiBaseUrl}/Api/thread?id=${threadId}&page=${page}`;
                pagePromises.push(fetchPage(pageUrl, headers));
            }
            const subsequentPagesData = await Promise.all(pagePromises);
            for (const pageData of subsequentPagesData) {
                allReplies.push(...pageData.Replies);
            }
        }

        firstPageData.Replies = allReplies;

        const cacheDir = path.resolve('cache');
        if (!fs.existsSync(cacheDir)) {
            fs.mkdirSync(cacheDir);
        }

        const cachePath = path.join(cacheDir, `${threadId}.json`);
        fs.writeFileSync(cachePath, JSON.stringify(firstPageData, null, 4));

        convertToText(threadId);
        convertToTextPoOnly(threadId);
        convertToMarkdown(threadId);
        convertToMarkdownPoOnly(threadId);

        return json({ message: `Backup for thread ${threadId} successful` });
    } catch (error) {
        if (error instanceof Error) {
            return json({ message: error.message }, { status: 500 });
        }
        return json({ message: 'An unknown error occurred' }, { status: 500 });
    }
};
