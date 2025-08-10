import {userprofile} from '~/generated/bundle';

const LOCAL_STORAGE_KEY = 'userAccountData';

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
 * 保存当前的估值画像 (Valuation Profile)。
 *
 * 此函数会获取现有的 `UserAccountData`，更新或添加指定的 `ValuationProfile`，
 * 然后将整个 `UserAccountData` 写回 localStorage。
 * 如果 `profileToSave` 对象中没有 `profileId`，此操作将会失败。
 *
 * @param profileToSave 要保存的估值画像。它必须包含 `profileId`。
 */
export function saveValuationProfile(profileToSave: userprofile.v1.IValuationProfile): void {
    if (!profileToSave.profileId) {
        console.error("Cannot save a profile without a profileId.");
        return;
    }

    try {
        // 1. 加载现有的 UserAccountData，如果不存在则创建一个新的。
        const base64String = localStorage.getItem(LOCAL_STORAGE_KEY);
        let accountData: userprofile.v1.IUserAccountData;

        if (base64String) {
            const buffer = fromBase64(base64String);
            const decoded = userprofile.v1.UserAccountData.decode(buffer);
            // 使用 toObject 将其转换为普通的 JS 对象
            accountData = userprofile.v1.UserAccountData.toObject(decoded, { defaults: true });
        } else {
            // 如果 localStorage 中没有数据，则初始化一个空的账户数据结构
            accountData = {
                profiles: {},
                activeProfileId: '',
            };
        }

        // 2. 准备时间戳并更新 Profile Map 中的画像。
        const now = new Date();
        const timestamp = {
            seconds: Math.floor(now.getTime() / 1000),
            nanos: (now.getTime() % 1000) * 1e6
        };

        const existingProfile = accountData.profiles?.[profileToSave.profileId] ?? {};

        accountData.profiles = accountData.profiles ?? {};
        accountData.profiles[profileToSave.profileId] = {
            ...existingProfile,
            ...profileToSave,
            updatedAt: timestamp,
            createdAt: existingProfile.createdAt ?? profileToSave.createdAt ?? timestamp
        };

        // 3. 将当前保存的画像设置为激活画像。
        accountData.activeProfileId = profileToSave.profileId;

        // 4. 将更新后的 UserAccountData 对象序列化并存回 localStorage。
        const message = userprofile.v1.UserAccountData.fromObject(accountData);
        const buffer = userprofile.v1.UserAccountData.encode(message).finish();
        const newBase64String = toBase64(buffer);
        localStorage.setItem(LOCAL_STORAGE_KEY, newBase64String);

    } catch (error) {
        console.error("Failed to save valuation profile to localStorage:", error);
    }
}

/**
 * 从 localStorage 加载并返回活动的估值画像 (Valuation Profile)。
 *
 * 根据“暂不考虑多profile支持”的简化逻辑，此函数会加载整个`UserAccountData`，
 * 并简单地返回 `profiles` map中的第一个画像。
 *
 * @returns 第一个可用的用户估值画像，如果没有任何画像则返回 `null`。
 */
export function loadActiveValuationProfile(): userprofile.v1.IValuationProfile | null {
    try {
        const base64String = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (!base64String) {
            return null;
        }

        const buffer = fromBase64(base64String);
        const decodedMessage = userprofile.v1.UserAccountData.decode(buffer);
        const accountData = userprofile.v1.UserAccountData.toObject(decodedMessage);

        if (!accountData.profiles) {
            return null;
        }

        const profileIds = Object.keys(accountData.profiles);
        if (profileIds.length === 0) {
            return null;
        }

        // 展示不考虑多用户支持，我们直接返回第一个 profile
        const firstProfileId = profileIds[0];
        return accountData.profiles[firstProfileId];

    } catch (error) {
        console.error("Failed to load valuation profile from localStorage:", error);
        // 如果数据损坏或解析失败，清除它
        localStorage.removeItem(LOCAL_STORAGE_KEY);
        return null;
    }
}
