import { uservaluation } from '~/generated/bundle';

const LOCAL_STORAGE_KEY = 'userValuationDatabase';

/**
 * 将 Uint8Array 编码为 Base64 字符串。
 * 这是一个在浏览器环境中安全的实现，使用 btoa。
 * @param bytes 要编码的字节数组。
 * @returns Base64 编码后的字符串。
 */
function toBase64(bytes: Uint8Array): string {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

/**
 * 将 Base64 字符串解码回 Uint8Array。
 * 这是一个在浏览器环境中安全的实现，使用 atob。
 * @param base64 要解码的 Base64 字符串。
 * @returns 解码后的字节数组。
 */
function fromBase64(base64: string): Uint8Array {
    const binary_string = window.atob(base64);
    const len = binary_string.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes;
}

/**
 * 将用户的整个估值数据库保存到 localStorage。
 * 数据被序列化为 Protobuf 的二进制 wire 格式，然后作为 Base64 字符串存储。
 * @param db 用户估值数据库对象。
 */
export function saveUserValuationDatabase(db: uservaluation.v1.IUserValuationDatabase): void {
    try {
        // 确保我们正在处理的是一个用于编码的消息实例
        const message = uservaluation.v1.UserValuationDatabase.fromObject(db);
        // 将消息编码为 Uint8Array (wire 格式)
        const buffer = uservaluation.v1.UserValuationDatabase.encode(message).finish();
        // 将二进制缓冲区转换为 Base64 字符串以便存入 localStorage
        const base64String = toBase64(buffer);
        localStorage.setItem(LOCAL_STORAGE_KEY, base64String);
    } catch (error) {
        console.error("Failed to save user valuation database to localStorage:", error);
    }
}

/**
 * 从 localStorage 加载用户的估值数据库。
 * 它会读取 Base64 字符串，解码，并将其反序列化为 JavaScript 对象。
 * @returns 加载的用户估值数据库，如果未找到或出错则返回 null。
 */
export function loadUserValuationDatabase(): uservaluation.v1.IUserValuationDatabase | null {
    try {
        const base64String = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (!base64String) {
            return null;
        }

        // 将 Base64 字符串转换回 Uint8Array
        const buffer = fromBase64(base64String);

        // 将 wire 格式的缓冲区解码为消息实例
        const decodedMessage = uservaluation.v1.UserValuationDatabase.decode(buffer);

        // React 组件期望的是普通的 JS 对象 (接口)，而不是消息实例，因此需要转换
        return uservaluation.v1.UserValuationDatabase.toObject(decodedMessage);
    } catch (error) {
        console.error("Failed to load user valuation database from localStorage:", error);
        // 如果解码失败，数据可能已损坏，所以我们将其清除。
        localStorage.removeItem(LOCAL_STORAGE_KEY);
        return null;
    }
}
