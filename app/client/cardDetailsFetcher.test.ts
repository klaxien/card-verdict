// app/client/cardDetailsFetcher.test.ts
import {describe, expect, it} from 'vitest';
import {getCardDatabase} from './cardDetailsFetcher'; // 确保路径正确
import {cardverdict} from '~/generated/bundle.js';

describe('CardDatabase real fetcher test (via MSW bridge)', () => {
    it('should successfully fetch, via an intercepted request, the REAL .pb file content and decode it', async () => {
        // 直接调用生产代码，它会被我们在 setup.ts 中全局启动的 MSW 自动拦截
        const database = await getCardDatabase();

        // 断言逻辑保持不变
        expect(database).toBeInstanceOf(cardverdict.v1.CreditCardDatabase);
        expect(database.cards.length).toBeGreaterThan(0);
    });
});
