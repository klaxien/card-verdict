/**
 * 创建一个可复用的验证器函数，用于检查字符串长度是否超过最大值。
 * @param maxLength - 允许的最大字符数。
 * @param fieldName - 在错误消息中显示的字段名称 (例如 "备注")。
 * @returns 一个符合 react-hook-form `validate` 规则的函数。
 */
export const createLengthValidator = (maxLength: number, fieldName: string = '输入') =>
    (value: string | null | undefined): true | string => {
        if (value && value.length > maxLength) {
            return `${fieldName}不能超过${maxLength}个字符`;
        }
        return true;
    };