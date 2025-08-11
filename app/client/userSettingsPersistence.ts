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

/**
 * 生成带有当前时间戳的备份文件名。
 * @returns {string} e.g., "card-verdict-backup-20231027053000.json"
 */
function generateBackupFilename(): string {
    const now = new Date();
    const YYYY = now.getFullYear();
    const MM = String(now.getMonth() + 1).padStart(2, '0');
    const DD = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    return `card-verdict-backup-${YYYY}${MM}${DD}${hh}${mm}${ss}.json`;
}


/**
 * [新增] 准备用于备份的数据。
 * 此函数从 localStorage 读取、解码，并构建包含两份数据的备份结构。
 * @returns 一个包含文件名和 JSON 内容的对象，如果没有数据则返回 null。
 */
export function getBackupData(): { filename: string; content: string } | null {
    const base64String = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!base64String) {
        return null;
    }

    try {
        const buffer = fromBase64(base64String);
        const decodedMessage = userprofile.v1.UserAccountData.decode(buffer);
        const readableData = userprofile.v1.UserAccountData.toObject(decodedMessage, {
            longs: String,
            enums: String,
            defaults: true,
        });

        const backupObject = {
            metadata: {
                fileFormatVersion: "1.0",
                appName: "CardVerdict",
                exportDate: new Date().toISOString(),
                description: "CardVerdict backup file. The 'backupData' field is used for restoration. 'readableData' is for reference only.",
            },
            readableData: readableData,
            backupData: base64String,
        };

        const jsonString = JSON.stringify(backupObject, null, 2);

        return {
            filename: generateBackupFilename(),
            content: jsonString,
        };

    } catch (error) {
        console.error("Failed to prepare backup data:", error);
        return null;
    }
}

/**
 * [新增] 从 JSON 文件内容中恢复数据。
 * 此函数负责解析、验证并写入 localStorage。
 * @param jsonContent 从上传的 .json 文件中读取的字符串内容。
 * @returns 一个包含操作结果的对象。
 */
export function restoreDataFromJson(jsonContent: string): { success: boolean; error?: string } {
    try {
        const parsedJson = JSON.parse(jsonContent);
        const backupDataString = parsedJson?.backupData;

        if (typeof backupDataString !== 'string' || backupDataString.length === 0) {
            return {success: false, error: "JSON 文件中未找到有效的 'backupData' 字段。"};
        }

        // 验证 base64 和 protobuf 结构
        const buffer = fromBase64(backupDataString);
        userprofile.v1.UserAccountData.decode(buffer); // 如果解码失败，会抛出异常

        // 写入存储
        localStorage.setItem(LOCAL_STORAGE_KEY, backupDataString);
        return {success: true};

    } catch (error) {
        console.error("Restore failed:", error);
        const errorMessage = error instanceof Error ? error.message : "未知错误";
        return {success: false, error: `文件格式无效或已损坏。(${errorMessage})`};
    }
}

export function clearAllData(): void {
    try {
        localStorage.removeItem(LOCAL_STORAGE_KEY);
    } catch (error) {
        // 虽然罕见，但仍需处理可能的存储错误 (例如在某些隐私模式下)
        console.error("Failed to clear data from localStorage:", error);
    }
}


