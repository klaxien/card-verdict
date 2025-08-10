// app/test/mocks/handlers.ts
import {http, HttpResponse} from 'msw';
import fs from 'fs';
import path from 'path';

// 定义真实的 .pb 文件路径
const realPbPath = path.resolve(process.cwd(), 'public/pb/card-database.pb');

export const handlers = [
    // 拦截对目标文件的 GET 请求
    http.get('/card-verdict/pb/card-database.pb', () => {
        try {
            const realFileBuffer = fs.readFileSync(realPbPath);
            return new HttpResponse(realFileBuffer, {
                headers: {'Content-Type': 'application/octet-stream'},
            });
        } catch (error) {
            console.error(`[MSW] Failed to read real .pb file at ${realPbPath}`, error);
            return new HttpResponse(null, {status: 404, statusText: 'File Not Found'});
        }
    }),
    // ... 您可以在这里添加其他需要 mock 的 API
];
