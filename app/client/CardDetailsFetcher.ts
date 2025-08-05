import {cardverdict} from "~/generated/bundle.js";


export async function getCardDatabase(): Promise<cardverdict.v1.CreditCardDatabase> {
    try {
        const response = await fetch('/pb/card-database.pb');
        if (!response.ok) {
            throw new Error(`Failed to fetch card database: ${response.statusText}`);
        }

        const buffer = await response.arrayBuffer();
        const uint8Array = new Uint8Array(buffer);
        console.log(cardverdict.v1.CreditCardDatabase.decode(uint8Array));

        return cardverdict.v1.CreditCardDatabase.decode(uint8Array);
    } catch (error) {
        console.error('Error loading card database:', error);
        throw error;
    }
}
