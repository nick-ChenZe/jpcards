import {readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fixturePath = resolve(root, 'fixtures/image-name-cards.json');
const live = process.argv.includes('--live');

const fixtures = JSON.parse(readFileSync(fixturePath, 'utf8'));
const groups = ['cjk-latin', 'fine-text', 'unusual-name'];
const seen = new Set(fixtures.map((item) => item.group));

for (const group of groups) {
    if (!seen.has(group)) {
        console.error(`缺少评测分组：${group}`);
        process.exit(1);
    }
}

console.log(`姓名卡夹具 ${fixtures.length} 张，未发送任何生图请求。`);
for (const item of fixtures) {
    console.log(`- [${item.group}] ${item.id}: ${item.displayName}`);
}

if (live) {
    console.error('通义生图客户端还没有接入。正式模型应为 qwen-image-3.0，turbo 只用于预览。本次不会请求百炼。');
    process.exit(2);
}

console.log('盲评脚本仍是占位。有密钥之后再比较 qwen-image-3.0 与 qwen-image-2.1-turbo。');
