import React, {useEffect, useMemo, useState} from 'react';
import {
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    Stack,
    Typography,
    useMediaQuery,
    useTheme,
} from '@mui/material';
import {cardverdict, userprofile} from '~/generated/bundle';
import {calcRawAnnualCents} from "~/utils/cardCalculations";
import {CreditRow} from "./CreditRow";
import {CustomAdjustmentsEditor} from "./CustomAdjustmentsEditor";
import {loadActiveValuationProfile, saveValuationProfile} from '~/client/UserSettingsPersistence';

type CustomValue = userprofile.v1.ICustomValue;
type UserCardValuation = userprofile.v1.IUserCardValuation;
type Credit = cardverdict.v1.ICredit;
type CreditCard = cardverdict.v1.ICreditCard;
type CustomAdjustment = userprofile.v1.ICustomAdjustment;

type LastEdited = 'dollars' | 'proportion' | undefined;

type CardEditProps = {
    open: boolean;
    card: CreditCard;
    displayCredits?: Credit[];
    initialValuation?: UserCardValuation;
    onCustomValuationClear?: () => void;
    onClose: () => void;
    onSave?: (valuation: UserCardValuation) => void;
    singleCreditIdToEdit?: string;
    singleCustomAdjustmentIdToEdit?: string;
};


type RowState = {
    dollarsInput: string;
    proportionInput: string;
    explanation: string;
    lastEdited: LastEdited;
    dollarsError?: string | null;
    proportionError?: string | null;
};


// ------------------------------
// Utilities
// ------------------------------

const emptyValuation = (): UserCardValuation => ({
    creditValuations: {},
    otherBenefitValuations: {},
    customAdjustments: [],
});

// 清洗规则：先去掉空白，再去掉前后的非数字字符（仅边界）
const stripWhitespace = (s: string) => s.replace(/\s+/g, '');
const stripEdgeNonDigits = (s: string) => s.replace(/^[^\d\-\.]+/, '').replace(/[^\d]+$/, '');
const cleanEdge = (s: string) => stripEdgeNonDigits(stripWhitespace(s));

const parseNumberFromInput = (raw: string): number | null => {
    const cleaned = cleanEdge(raw);
    if (cleaned === '') return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
};

// 保留两位小数，允许空字符串（非负）
const normalizeDollarString = (input: string): string => {
    const cleaned = cleanEdge(input);
    if (cleaned.trim() === '') return '';
    const numberValue = Number(cleaned.replace(/,/g, ''));
    if (Number.isNaN(numberValue) || !Number.isFinite(numberValue) || numberValue < 0) return '';
    return numberValue.toFixed(2);
};

// 比例两位小数，截断到 [0,1]
const normalizeProportionString = (input: string): string => {
    const cleaned = cleanEdge(input);
    if (cleaned.trim() === '') return '';
    const numberValue = Number(cleaned);
    if (Number.isNaN(numberValue) || !Number.isFinite(numberValue)) return '';
    const clamped = Math.max(0, Math.min(1, numberValue));
    return clamped.toFixed(2);
};

// 校验：美元（>=0，最多两位小数），允许空串
const validateDollars = (raw: string): { ok: boolean; msg?: string; cleaned?: string } => {
    if (raw.trim() === '') return {ok: true, cleaned: ''};
    const cleaned = cleanEdge(raw);
    if (cleaned === '') return {ok: false, msg: '请输入数字'};
    // 必须是“纯数字+可选两位小数”，中间不能混字母
    if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return {ok: false, msg: '最多两位小数，且不能包含字母'};
    return {ok: true, cleaned};
};

// 校验：比例（0-1，最多两位小数），允许空串
const validateProportion = (raw: string): { ok: boolean; msg?: string; cleaned?: string } => {
    if (raw.trim() === '') return {ok: true, cleaned: ''};
    const cleaned = cleanEdge(raw);
    if (cleaned === '') return {ok: false, msg: '请输入数字'};
    if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return {ok: false, msg: '最多两位小数，且不能包含字母'};
    const num = Number(cleaned);
    if (num < 0 || num > 1) return {ok: false, msg: '需在 0 到 1 之间'};
    return {ok: true, cleaned};
};

// 仅在当前编辑字段有效时才联动另一字段；无效时不动联动字段，也不清空
const syncLinkedFieldBySource = (
    draftRow: RowState,
    lastEditedSource: LastEdited,
    annualFaceValueDollars: number,
): RowState => {
    const updated = {...draftRow};

    if (lastEditedSource === 'dollars') {
        const v = validateDollars(updated.dollarsInput);
        if (v.ok && v.cleaned && annualFaceValueDollars > 0) {
            const dollarsNumber = Number(v.cleaned);
            updated.proportionInput = (dollarsNumber / annualFaceValueDollars).toFixed(2);
        }
        updated.lastEdited = 'dollars';
    } else if (lastEditedSource === 'proportion') {
        const v = validateProportion(updated.proportionInput);
        if (v.ok && v.cleaned) {
            const proportionNumber = Number(v.cleaned);
            updated.dollarsInput = (proportionNumber * annualFaceValueDollars).toFixed(2);
        }
        updated.lastEdited = 'proportion';
    }

    return updated;
};

/**
 * 失焦时的规范化与联动（两位小数）
 * 如果输入有效，则格式化当前字段并联动更新另一字段。
 * 如果输入无效，则不进行任何操作，以保留用户的原始输入和错误状态。
 */
const normalizeRowOnBlur = (
    draftRow: RowState,
    field: 'dollars' | 'proportion',
    annualFaceValueDollars: number,
): RowState => {
    const updated = {...draftRow};

    if (field === 'dollars') {
        const validationResult = validateDollars(updated.dollarsInput);
        if (!validationResult.ok) {
            return updated; // 输入无效，保留原样，不进行联动
        }

        const normalizedDollars = normalizeDollarString(updated.dollarsInput);
        updated.dollarsInput = normalizedDollars;
        const n = normalizedDollars ? Number(normalizedDollars) : null;
        updated.proportionInput =
            n != null && annualFaceValueDollars > 0
                ? (n / annualFaceValueDollars).toFixed(2)
                : '';
        updated.lastEdited = 'dollars';
    } else { // field === 'proportion'
        const validationResult = validateProportion(updated.proportionInput);
        if (!validationResult.ok) {
            return updated; // 输入无效，保留原样，不进行联动
        }

        const normalizedProportion = normalizeProportionString(updated.proportionInput);
        updated.proportionInput = normalizedProportion;
        const p = normalizedProportion ? Number(normalizedProportion) : null;
        updated.dollarsInput =
            p != null && annualFaceValueDollars > 0
                ? (p * annualFaceValueDollars).toFixed(2)
                : '';
        updated.lastEdited = 'proportion';
    }

    return updated;
};

// ------------------------------
// 自定义报销（CustomAdjustment）支持
// ------------------------------
// 1) 将新增自定义项的默认频率改为 ANNUAL，避免未指定
const newCustomAdjustment = (): CustomAdjustment => ({
    customAdjustmentId: (globalThis.crypto?.randomUUID?.() ?? `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`),
    description: '',
    frequency: cardverdict.v1.CreditFrequency.ANNUAL, // 原来是 FREQUENCY_UNSPECIFIED
    valueCents: 0,
    notes: '',
});

// ------------------------------
// 主组件（仅展示与自定义报销相关的新逻辑）
// ------------------------------
const ValuationEditComponent: React.FC<CardEditProps> = ({
                                                             open,
                                                             card,
                                                             displayCredits,
                                                             initialValuation,
                                                             onCustomValuationClear,
                                                             onClose,
                                                             onSave,
                                                             singleCreditIdToEdit,
                                                             singleCustomAdjustmentIdToEdit,
                                                         }) => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    // 二次确认对话框
    const [confirmClearOpen, setConfirmClearOpen] = useState(false);

    // 用于渲染的顺序（由父组件传入），对话框会基于该顺序进行“置顶”，但在一次打开会话中不再实时变动
    const credits: Credit[] = React.useMemo(
        () => (displayCredits && displayCredits.length ? displayCredits : card.credits ?? []),
        [displayCredits, card.credits],
    );

    // 预先计算每个 credit 的年度面值（分）
    const rawAnnualFaceCentsByCreditId = React.useMemo(() => {
        const result = new Map<string, number>();
        for (const creditItem of credits) {
            const creditId = creditItem.creditId ?? '';
            if (!creditId) continue;
            result.set(creditId, calcRawAnnualCents(creditItem));
        }
        return result;
    }, [credits]);

    // 行状态：按 creditId 保存
    const [rowStateByCreditId, setRowStateByCreditId] = React.useState<Record<string, RowState>>({});

    // 本次打开会话的渲染顺序（只在打开时计算一次；编辑过程中不变）
    const [sessionCredits, setSessionCredits] = React.useState<Credit[]>(credits);

    // [FIX] 用于在对话框打开期间“冻结”视图模式，防止关闭动画时内容闪烁
    const [sessionSingleCreditId, setSessionSingleCreditId] = useState<string | undefined>();
    const [sessionSingleCustomAdjustmentId, setSessionSingleCustomAdjustmentId] = useState<string | undefined>();

    // 初始化/重置表单 + 会话内排序（基于 initialValuation 是否有编辑痕迹来置顶）
    React.useEffect(() => {
        if (!open) return;

        // [FIX] 捕获打开时的编辑模式
        setSessionSingleCreditId(singleCreditIdToEdit);
        setSessionSingleCustomAdjustmentId(singleCustomAdjustmentIdToEdit);

        // 1) 先构建表单初始值
        const initialUserValuation = initialValuation ?? emptyValuation();
        const nextStateByCreditId: Record<string, RowState> = {};

        for (const creditItem of credits) {
            const creditId = creditItem.creditId ?? '';
            if (!creditId) continue;

            const userCreditValuation = initialUserValuation.creditValuations?.[creditId];
            const annualFaceValueDollars = (rawAnnualFaceCentsByCreditId.get(creditId) ?? 0) / 100;

            if (userCreditValuation?.cents != null) {
                const dollars = (userCreditValuation.cents / 100).toFixed(2);
                const proportion = annualFaceValueDollars
                    ? (userCreditValuation.cents / 100 / annualFaceValueDollars).toFixed(2)
                    : '';
                nextStateByCreditId[creditId] = {
                    dollarsInput: dollars,
                    proportionInput: proportion,
                    explanation: userCreditValuation.explanation ?? '',
                    lastEdited: 'dollars',
                    dollarsError: null,
                    proportionError: null,
                };
                continue;
            }

            if (userCreditValuation?.proportion != null) {
                const dollars = annualFaceValueDollars
                    ? (userCreditValuation.proportion * annualFaceValueDollars).toFixed(2)
                    : '';
                nextStateByCreditId[creditId] = {
                    dollarsInput: dollars,
                    proportionInput: Number(userCreditValuation.proportion).toFixed(2),
                    explanation: userCreditValuation.explanation ?? '',
                    lastEdited: 'proportion',
                    dollarsError: null,
                    proportionError: null,
                };
                continue;
            }

            // 仅有说明（无估值）也要回显
            if ((userCreditValuation?.explanation?.trim()?.length ?? 0) > 0) {
                nextStateByCreditId[creditId] = {
                    dollarsInput: '',
                    proportionInput: '',
                    explanation: userCreditValuation!.explanation ?? '',
                    lastEdited: undefined,
                    dollarsError: null,
                    proportionError: null,
                };
                continue;
            }

            nextStateByCreditId[creditId] = {
                dollarsInput: '',
                proportionInput: '',
                explanation: '',
                lastEdited: undefined,
                dollarsError: null,
                proportionError: null,
            };
        }

        setRowStateByCreditId(nextStateByCreditId);

        // 如果是单个 credit 编辑模式，则只显示那个 credit
        if (singleCreditIdToEdit) {
            const creditToEdit = credits.find(c => c.creditId === singleCreditIdToEdit);
            setSessionCredits(creditToEdit ? [creditToEdit] : []);
        } else if (singleCustomAdjustmentIdToEdit) {
            setSessionCredits([]);
        } else {
            // 否则，采用父组件传入的顺序
            setSessionCredits(credits);
        }
    }, [open, credits, rawAnnualFaceCentsByCreditId, initialValuation, singleCreditIdToEdit, singleCustomAdjustmentIdToEdit]);

    // 行级操作：在变更时做校验并标红；联动仍然基于清洗后的数值
    const updateRow = React.useCallback(
        (creditId: string, patch: Partial<RowState>, source?: LastEdited) => {
            setRowStateByCreditId((previousState) => {
                const currentRowState: RowState =
                    previousState[creditId] ?? {
                        dollarsInput: '',
                        proportionInput: '',
                        explanation: '',
                        lastEdited: undefined,
                        dollarsError: null,
                        proportionError: null,
                    };

                let next: RowState = {...currentRowState, ...patch};

                // 校验当前改动字段
                if (source === 'dollars') {
                    const res = validateDollars(next.dollarsInput);
                    next.dollarsError = res.ok ? null : res.msg ?? '输入无效';
                } else if (source === 'proportion') {
                    const res = validateProportion(next.proportionInput);
                    next.proportionError = res.ok ? null : res.msg ?? '输入无效';
                }

                const annualFaceValueDollars = (rawAnnualFaceCentsByCreditId.get(creditId) ?? 0) / 100;
                next = syncLinkedFieldBySource(next, source, annualFaceValueDollars);

                return {...previousState, [creditId]: next};
            });
        },
        [rawAnnualFaceCentsByCreditId],
    );

    // 仅对当前编辑的字段做校验；联动字段不标红
    const handleBlurRow = React.useCallback(
        (creditId: string, field: 'dollars' | 'proportion') => {
            setRowStateByCreditId((previousState) => {
                const currentRowState = previousState[creditId];
                if (!currentRowState) return previousState;

                const annualFaceValueDollars = (rawAnnualFaceCentsByCreditId.get(creditId) ?? 0) / 100;
                const normalized = normalizeRowOnBlur(currentRowState, field, annualFaceValueDollars);

                const next: RowState = {...normalized};

                if (field === 'dollars') {
                    const dRes = validateDollars(next.dollarsInput);
                    next.dollarsError = dRes.ok ? null : dRes.msg ?? '输入无效';
                    // 不碰 proportionError，避免把错误显示在未编辑的框里
                } else {
                    const pRes = validateProportion(next.proportionInput);
                    next.proportionError = pRes.ok ? null : pRes.msg ?? '输入无效';
                    // 不碰 dollarsError
                }

                return {...previousState, [creditId]: next};
            });
        },
        [rawAnnualFaceCentsByCreditId],
    );

    const clearRowState = React.useCallback((creditId: string) => {
        setRowStateByCreditId((previousState) => ({
            ...previousState,
            [creditId]: {
                dollarsInput: '',
                proportionInput: '',
                explanation: '',
                lastEdited: undefined,
                dollarsError: null,
                proportionError: null,
            },
        }));
    }, []);

    // 新增：收集“自定义报销”内的错误，用于禁用保存
    const [customAdjustmentsHasError, setCustomAdjustmentsHasError] = useState(false);

    // 表单是否存在错误（合并自定义报销的错误）
    const hasAnyError = React.useMemo(() => {
        return Object.values(rowStateByCreditId).some(
            (r) => !!r.dollarsError || !!r.proportionError,
        ) || customAdjustmentsHasError;
    }, [rowStateByCreditId, customAdjustmentsHasError]);

    // 自定义报销 state 初始化与同步（camelCase：customAdjustments）
    const [customAdjustments, setCustomAdjustments] = useState<userprofile.v1.ICustomAdjustment[]>(
        initialValuation?.customAdjustments ? [...initialValuation.customAdjustments] : [],
    );

    // 当对话框“打开”时，用最新的 initialValuation 重置草稿，确保取消不会保留未保存的编辑
    useEffect(() => {
        if (open) {
            setCustomAdjustments(initialValuation?.customAdjustments ? [...initialValuation.customAdjustments] : []);
        }
    }, [open, initialValuation]);


    useEffect(() => {
        setCustomAdjustments(initialValuation?.customAdjustments ? [...initialValuation.customAdjustments] : []);
    }, [initialValuation]);

    const handleAddCustomAdjustment = () => {
        setCustomAdjustments(prev => [...prev, newCustomAdjustment()]);
    };

    const handleUpdateCustomAdjustment = (id: string, patch: Partial<CustomAdjustment>) => {
        setCustomAdjustments(prev =>
            prev.map(item => (item.customAdjustmentId === id ? {...item, ...patch} : item)),
        );
    };

    const handleDeleteCustomAdjustment = (id: string) => {
        setCustomAdjustments(prev => prev.filter(item => item.customAdjustmentId !== id));
    };

    // 保存：允许仅保存说明；若有错误则禁用保存
    const handleSaveCredit = React.useCallback(() => {
        if (hasAnyError) return;

        const outputValuation: UserCardValuation = {
            creditValuations: {},
            otherBenefitValuations: {},
            customAdjustments: [],
        };

        for (const creditItem of credits) {
            const creditId = creditItem.creditId ?? '';
            if (!creditId) continue;

            const rowState = rowStateByCreditId[creditId];
            if (!rowState) continue;

            let saved = false;

            if (rowState.lastEdited === 'dollars') {
                const dollarsNumber = Number(normalizeDollarString(rowState.dollarsInput));
                if (rowState.dollarsInput !== '' && Number.isFinite(dollarsNumber) && !Number.isNaN(dollarsNumber)) {
                    outputValuation.creditValuations![creditId] = {
                        cents: Math.round(dollarsNumber * 100),
                        explanation: rowState.explanation,
                    } as CustomValue;
                    saved = true;
                }
            } else if (rowState.lastEdited === 'proportion') {
                const proportionNumber = Number(normalizeProportionString(rowState.proportionInput));
                if (rowState.proportionInput !== '' && Number.isFinite(proportionNumber) && !Number.isNaN(proportionNumber)) {
                    outputValuation.creditValuations![creditId] = {
                        proportion: proportionNumber,
                        explanation: rowState.explanation,
                    } as CustomValue;
                    saved = true;
                }
            }

            // 仅说明：也写入（不设置 oneof 值）
            if (!saved && (rowState.explanation?.trim().length ?? 0) > 0) {
                outputValuation.creditValuations![creditId] = {
                    explanation: rowState.explanation,
                } as CustomValue;
            }
        }

        return outputValuation;
    }, [credits, rowStateByCreditId, hasAnyError]);

    // [FIX] 保存时合并 credit 编辑和 custom adjustment 编辑
    const handleSave = () => {
        const creditValuationResult = handleSaveCredit();
        if (!creditValuationResult) {
            return;
        }

        const newTotalValuation: UserCardValuation = {
            ...(initialValuation ?? emptyValuation()),
            creditValuations: creditValuationResult.creditValuations,
            customAdjustments: customAdjustments,
        };

        onSave?.(newTotalValuation);
        onClose();
    };

    // 新增：清空当前卡片的所有自定义设置（credit + custom），直接从 map 中删除并持久化
    const handleConfirmClear = () => {
        try {
            const db = loadActiveValuationProfile() ?? {cardValuations: {}, pointSystemValuations: {}};
            const cardId = card.cardId ?? '';
            if (cardId) {
                if (db.cardValuations && Object.prototype.hasOwnProperty.call(db.cardValuations, cardId)) {
                    delete db.cardValuations[cardId];
                }
                saveValuationProfile(db);
            }
        } catch (e) {
            console.error('Failed to clear card valuation:', e);
        } finally {
            // 重置本地 UI，通知父组件刷新，并关闭弹窗
            setRowStateByCreditId({});
            setCustomAdjustments([]);
            setConfirmClearOpen(false);
            onCustomValuationClear?.(); // 新增：通知父层把 userValuation 清空
            onClose();
        }
    };

    // 会话内冻结的标题，防止关闭动画期间因 props 变化造成闪动
    const [sessionTitle, setSessionTitle] = React.useState<string>('');

    React.useEffect(() => {
        if (open) {
            if (singleCustomAdjustmentIdToEdit) {
                setSessionTitle(`编辑自定义调整 — ${card.name}`);
            } else {
                setSessionTitle(`编辑${singleCreditIdToEdit ? '单项' : ''}报销估值 — ${card.name}`);
            }
        }
    }, [open, card.name, singleCreditIdToEdit, singleCustomAdjustmentIdToEdit]);

    // ------------------------------
    // Render
    // ------------------------------
    return (
        <>
            <Dialog
                fullScreen={isMobile}
                open={open}
                onClose={onClose}
                maxWidth="md"
                fullWidth
                slotProps={{
                    paper: {
                        sx: {
                            paddingBottom: {xs: 'env(safe-area-inset-bottom)'},
                        }
                    }
                }}
            >
                <DialogTitle>{sessionTitle}</DialogTitle>

                <DialogContent
                    dividers
                    sx={{
                        // 为底部操作区预留空间（按钮高度 + 间距 + 安全区）
                        pb: {
                            xs: 'calc(96px + env(safe-area-inset-bottom))',
                        },
                    }}
                >
                    {sessionCredits.length > 0 && (
                        <Stack spacing={2}>
                            {sessionCredits.map((credit, index) => {
                                const creditId = credit.creditId ?? '';
                                const rowState =
                                    rowStateByCreditId[creditId] ?? {
                                        dollarsInput: '',
                                        proportionInput: '',
                                        explanation: '',
                                        lastEdited: undefined,
                                        dollarsError: null,
                                        proportionError: null,
                                    };

                                const annualFaceValueDollars = (rawAnnualFaceCentsByCreditId.get(creditId) ?? 0) / 100;
                                const hasProportionDefault = credit.defaultEffectiveValueProportion != null;
                                const isLastRow = index === sessionCredits.length - 1;

                                return (
                                    <CreditRow
                                        key={creditId || index}
                                        credit={credit}
                                        row={rowState}
                                        faceDollars={annualFaceValueDollars}
                                        hasProportionDefault={hasProportionDefault}
                                        isLastRow={isLastRow}
                                        onChange={(patch, source) => updateRow(creditId, patch, source)}
                                        onBlur={(field) => handleBlurRow(creditId, field)}
                                        onClear={() => clearRowState(creditId)}
                                    />
                                );
                            })}
                        </Stack>
                    )}

                    {sessionCredits.length > 0 && !sessionSingleCreditId && <Divider sx={{my: 2}}/>}

                    {!sessionSingleCreditId && (
                        <CustomAdjustmentsEditor
                            customAdjustments={customAdjustments}
                            onAdd={handleAddCustomAdjustment}
                            onUpdate={handleUpdateCustomAdjustment}
                            onDelete={handleDeleteCustomAdjustment}
                            sessionSingleCustomAdjustmentId={sessionSingleCustomAdjustmentId}
                            onValidityChange={setCustomAdjustmentsHasError}
                        />
                    )}
                </DialogContent>

                <DialogActions
                    sx={{
                        // 粘底并覆盖整行
                        position: {xs: 'sticky', sm: 'static'},
                        bottom: 0,
                        zIndex: 1,
                        bgcolor: 'background.paper',
                        borderTop: (theme) => `1px solid ${theme.palette.divider}`,
                        // 留出安全区内边距，提升全面屏手势区的可点性
                        pb: {xs: 'max(env(safe-area-inset-bottom), 8px)', sm: 2},
                        pt: 1,
                    }}
                >
                    {/* 左下角红色“清空”按钮 */}
                    <Button
                        color="error"
                        variant="text"
                        onClick={() => setConfirmClearOpen(true)}
                    >
                        清空
                    </Button>

                    {/* 占位将右侧内容推到右边 */}
                    <Typography variant="caption" color={hasAnyError ? 'error' : 'text.secondary'} sx={{ml: 'auto'}}>
                        {hasAnyError ? '存在无效输入，请修正后再保存' : ' '}
                    </Typography>
                    <Button onClick={onClose}>取消</Button>
                    <Button variant="contained" onClick={handleSave} disabled={hasAnyError}>保存</Button>
                </DialogActions>
            </Dialog>

            {/* 二次确认对话框 */}
            <Dialog
                open={confirmClearOpen}
                onClose={() => setConfirmClearOpen(false)}
                maxWidth="xs"
                fullWidth
            >
                <DialogTitle>确认清空？</DialogTitle>
                <DialogContent dividers>
                    <Typography variant="body2">
                        这将清除“{card.name}”的所有自定义设置（报销估值与自定义调整），此操作不可撤销。
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setConfirmClearOpen(false)}>取消</Button>
                    <Button color="error" variant="contained" onClick={handleConfirmClear}>
                        确认清空
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
};

export default ValuationEditComponent;
