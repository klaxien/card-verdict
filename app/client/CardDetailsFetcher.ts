import {cardverdict} from "~/generated/bundle.js";

// 使用 Vite 的 BASE_URL，兼容子路径部署（/CardVerdict/）
const base = import.meta.env.BASE_URL ?? '/';

export async function getCardDatabase(): Promise<cardverdict.v1.CreditCardDatabase> {
    try {
        const response = await fetch(`${base}pb/card-database.pb`);
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
