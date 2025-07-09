import * as fs from 'fs';
import * as path from 'path';

const contentProcess = (content: string) => {
    return content.replace(/<font color="#789922">&gt;&gt;/g, '>>').replace(/<\/font><br \/>/g, '\n')
        .replace(/<\/font>/g, '\n')
        .replace(/<br \/>\r\n/g, '\n').replace(/<br \/>\n/g, '\n');
}

const generateSavepath = (id: string, title: string, ext: string, isPoOnly: boolean) => {
    const suffix = isPoOnly ? '_po_only' : '';
    const outputDir = path.resolve('output');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir);
    }
    if (title !== '无标题') {
        let filename = title.replace(/[\\/:*?"<>|]/g, '_');
        if (filename.length > 100) {
            filename = filename.substring(0, 100);
        }
        return path.join(outputDir, `${id}_${filename}${suffix}${ext}`);
    }
    return path.join(outputDir, `${id}${suffix}${ext}`);
}

export const convertToText = (id: string) => {
    const cachePath = path.resolve('cache', `${id}.json`);
    const jo = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
    let sb = '';
    sb += `${jo.user_hash}  ${jo.now}  No.${jo.id}\n`;
    const savepath = generateSavepath(id, jo.title, '.txt', false);
    if (jo.title !== '无标题') {
        sb += `标题:${jo.title}\n`;
    }
    sb += `${contentProcess(jo.content)}\n`;
    const ja = jo.Replies;
    for (let i = 0; i < ja.length; i++) {
        sb += `------------------------------------\n`;
        sb += `${ja[i].user_hash}  ${ja[i].now}  No.${ja[i].id}\n`;
        sb += `${contentProcess(ja[i].content)}\n`;
    }
    fs.writeFileSync(savepath, sb, 'utf-8');
}

export const convertToTextPoOnly = (id: string) => {
    const cachePath = path.resolve('cache', `${id}.json`);
    const poPath = path.resolve('po', `${id}.txt`);
    const jo = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
    let sb = '';
    sb += `${jo.user_hash}  ${jo.now}  No.${jo.id}\n`;
    const savepath = generateSavepath(id, jo.title, '.txt', true);
    if (jo.title !== '无标题') {
        sb += `标题:${jo.title}\n`;
    }
    sb += `${contentProcess(jo.content)}\n`;
    const ja = jo.Replies;
    const poid = new Set<string>();
    poid.add(jo.user_hash);
    if (fs.existsSync(poPath)) {
        const lines = fs.readFileSync(poPath, 'utf-8').split('\n');
        for (const line of lines) {
            poid.add(line.split(' ')[0]);
        }
    }
    for (let i = 0; i < ja.length; i++) {
        if (poid.has(ja[i].user_hash)) {
            sb += `------------------------------------\n`;
            sb += `${ja[i].user_hash}  ${ja[i].now}  No.${ja[i].id}\n`;
            sb += `${contentProcess(ja[i].content)}\n`;
        }
    }
    fs.writeFileSync(savepath, sb, 'utf-8');
}

export const convertToMarkdown = (id: string) => {
    const cachePath = path.resolve('cache', `${id}.json`);
    const poPath = path.resolve('po', `${id}.txt`);
    const jo = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
    let sb = '';
    const savepath = generateSavepath(id, jo.title, '.md', false);
    if (jo.title !== '无标题') {
        sb += `# ${jo.title}\n\n`;
    } else {
        sb += `# ${jo.id}\n\n`;
    }
    if (jo.name !== '无名氏' && jo.name !== '') {
        sb += `**${jo.name}**\n`;
    }
    sb += `No.${jo.id}  ${jo.user_hash}  ${jo.now}\n`;
    if (jo.img !== '') {
        const imageBaseUrl = 'https://image.nmb.best/image';
        sb += `![image](${imageBaseUrl}/${jo.img}${jo.ext})\n`;
    }
    sb += `${contentProcess(jo.content.replace(/<b>/g, '**').replace(/<\/b>/g, '**').replace(/<small>/g, '`').replace(/<\/small>/g, '`'))}\n`;
    const ja = jo.Replies;
    const poid = new Set<string>();
    poid.add(jo.user_hash);
    if (fs.existsSync(poPath)) {
        const lines = fs.readFileSync(poPath, 'utf-8').split('\n');
        for (const line of lines) {
            poid.add(line.split(' ')[0]);
        }
    }
    for (let i = 0; i < ja.length; i++) {
        if (poid.has(ja[i].user_hash)) {
            if (ja[i].title !== '无标题') {
                sb += `\n## ${ja[i].title}\n\n`;
            } else {
                sb += `\n## No.${ja[i].id}\n\n`;
            }
        } else {
            if (ja[i].title !== '无标题') {
                sb += `\n### ${ja[i].title}\n\n`;
            } else {
                sb += `\n### No.${ja[i].id}\n\n`;
            }
        }
        if (ja[i].name !== '无名氏' && ja[i].name !== '') {
            sb += `**${ja[i].name}**\n`;
        }
        sb += `No.${ja[i].id}  ${ja[i].user_hash}  ${ja[i].now}\n`;
        if (ja[i].img !== '') {
            const imageBaseUrl = 'https://image.nmb.best/image';
            sb += `![image](${imageBaseUrl}/${ja[i].img}${ja[i].ext})\n`;
        }
        sb += `${contentProcess(ja[i].content.replace(/<b>/g, '**').replace(/<\/b>/g, '**').replace(/<small>/g, '`').replace(/<\/small>/g, '`'))}\n`;
    }
    fs.writeFileSync(savepath, sb, 'utf-8');
}

export const convertToMarkdownPoOnly = (id: string) => {
    const cachePath = path.resolve('cache', `${id}.json`);
    const poPath = path.resolve('po', `${id}.txt`);
    const jo = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
    let sb = '';
    const savepath = generateSavepath(id, jo.title, '.md', true);
    if (jo.title !== '无标题') {
        sb += `\n# ${jo.title}\n\n`;
    } else {
        sb += `\n# ${jo.id}\n\n`;
    }
    if (jo.name !== '无名氏' && jo.name !== '') {
        sb += `**${jo.name}**\n`;
    }
    sb += `No.${jo.id}  ${jo.user_hash}  ${jo.now}\n`;
    if (jo.img !== '') {
        const imageBaseUrl = 'https://image.nmb.best/image';
        sb += `![image](${imageBaseUrl}/${jo.img}${jo.ext})\n`;
    }
    sb += `${contentProcess(jo.content.replace(/<b>/g, '**').replace(/<\/b>/g, '**').replace(/<small>/g, '`').replace(/<\/small>/g, '`'))}\n`;
    const ja = jo.Replies;
    const poid = new Set<string>();
    poid.add(jo.user_hash);
    if (fs.existsSync(poPath)) {
        const lines = fs.readFileSync(poPath, 'utf-8').split('\n');
        for (const line of lines) {
            poid.add(line.split(' ')[0]);
        }
    }
    for (let i = 0; i < ja.length; i++) {
        if (poid.has(ja[i].user_hash)) {
            if (ja[i].title !== '无标题') {
                sb += `\n## ${ja[i].title}\n\n`;
            } else {
                sb += `\n## No.${ja[i].id}\n\n`;
            }
            if (ja[i].name !== '无名氏' && ja[i].name !== '') {
                sb += `**${ja[i].name}**\n`;
            }
            sb += `${ja[i].user_hash}  ${ja[i].now}  No.${ja[i].id}\n`;
            if (ja[i].img !== '') {
                const imageBaseUrl = 'https://image.nmb.best/image';
                sb += `![image](${imageBaseUrl}/${ja[i].img}${ja[i].ext})\n`;
            }
            sb += `${contentProcess(ja[i].content.replace(/<b>/g, '**').replace(/<\/b>/g, '**').replace(/<small>/g, '`').replace(/<\/small>/g, '`'))}\n`;
        }
    }
    fs.writeFileSync(savepath, sb, 'utf-8');
}
