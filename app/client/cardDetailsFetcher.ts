import {cardverdict} from "~/generated/bundle.js";

// 使用 Vite 的 BASE_URL，兼容子路径部署（/card-verdict/）
const base = import.meta.env.BASE_URL ?? '/';

export async function getCardDatabase(): Promise<cardverdict.v1.CreditCardDatabase> {
    try {
        const isNode = typeof window === 'undefined';
        const url = isNode
            ? new URL(`${base}pb/card-database.pb`, 'http://localhost').toString()
            : `${base}pb/card-database.pb`;

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch card database: ${response.statusText}`);
        }

        const buffer = await response.arrayBuffer();
        const uint8Array = new Uint8Array(buffer);
        return cardverdict.v1.CreditCardDatabase.decode(uint8Array);
    } catch (error) {
        console.error('Error loading card database:', error);
        throw error;
    }
}
