import React, {useEffect, useMemo, useState} from 'react';
import {
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    Grid,
    IconButton,
    InputAdornment,
    TextField,
    Typography,
    Stack,
    Tooltip,
    useMediaQuery,
    useTheme,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
} from '@mui/material';
import ClearIcon from '@mui/icons-material/Clear';
import DeleteIcon from '@mui/icons-material/Delete';
import {cardverdict, uservaluation} from '~/generated/bundle';

type CustomValue = uservaluation.v1.ICustomValue;
type UserCardValuation = uservaluation.v1.IUserCardValuation;
type Credit = cardverdict.v1.ICredit;
type CreditCard = cardverdict.v1.ICreditCard;
type CustomAdjustment = uservaluation.v1.ICustomAdjustment;

type LastEdited = 'dollars' | 'proportion' | undefined;

type CardEditProps = {
    open: boolean;
    card: CreditCard;
    displayCredits?: Credit[];
    initialValuation?: UserCardValuation;
    onClose: () => void;
    onSave?: (valuation: UserCardValuation) => void;
    singleCreditIdToEdit?: string;
};

type RowState = {
    dollarsInput: string;
    proportionInput: string;
    explanation: string;
    lastEdited: LastEdited;
    dollarsError?: string | null;
    proportionError?: string | null;
};

const { CreditFrequency } = cardverdict.v1;


// ------------------------------
// Utilities
// ------------------------------

const PERIODS_PER_YEAR: Record<cardverdict.v1.CreditFrequency, number> = {
    [cardverdict.v1.CreditFrequency.FREQUENCY_UNSPECIFIED]: 0,
    [cardverdict.v1.CreditFrequency.ANNUAL]: 1,
    [cardverdict.v1.CreditFrequency.SEMI_ANNUAL]: 2,
    [cardverdict.v1.CreditFrequency.QUARTERLY]: 4,
    [cardverdict.v1.CreditFrequency.MONTHLY]: 12,
};

const periodsInYearFor = (
    frequency?: cardverdict.v1.CreditFrequency | null,
): number => (frequency == null ? 0 : PERIODS_PER_YEAR[frequency] ?? 0);

const calculateRawAnnualCents = (credit: Credit): number => {
    const periods = periodsInYearFor(credit.frequency);
    if (!periods) return 0;

    const basePeriodValueCents = credit.defaultPeriodValueCents ?? 0;
    const periodOverrides = credit.overrides ?? [];
    if (!periodOverrides.length) return basePeriodValueCents * periods;

    const overrideValueByPeriod = new Map<number, number>();
    for (const overrideItem of periodOverrides) {
        if (overrideItem.period != null && overrideItem.valueCents != null) {
            overrideValueByPeriod.set(overrideItem.period, overrideItem.valueCents);
        }
    }

    let totalCents = 0;
    for (let periodIndex = 1; periodIndex <= periods; periodIndex++) {
        totalCents += overrideValueByPeriod.get(periodIndex) ?? basePeriodValueCents;
    }
    return totalCents;
};

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

// 允许正负的美元值（最多两位小数），用于自定义报销
const validateSignedDollars = (raw: string): { ok: boolean; msg?: string; cleaned?: string } => {
    if (raw.trim() === '') return {ok: false, msg: '请输入金额（可为负数）'};
    const cleaned = cleanEdge(raw);
    if (cleaned === '') return {ok: false, msg: '请输入数字'};
    if (!/^-?\d+(\.\d{1,2})?$/.test(cleaned)) return {ok: false, msg: '最多两位小数，可加负号'};
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
const newCustomAdjustment = (): CustomAdjustment => ({
    customAdjustmentId: (globalThis.crypto?.randomUUID?.() ?? `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`),
    description: '',
    frequency: cardverdict.v1.CreditFrequency.FREQUENCY_UNSPECIFIED,
    valueCents: 0,
    notes: '',
});

const frequencyOptions: Array<{ label: string; value: cardverdict.v1.CreditFrequency }> = [
    {label: '每年一次', value: cardverdict.v1.CreditFrequency.ANNUAL},
    {label: '每半年一次', value: cardverdict.v1.CreditFrequency.SEMI_ANNUAL},
    {label: '每季度一次', value: cardverdict.v1.CreditFrequency.QUARTERLY},
    {label: '每月一次', value: cardverdict.v1.CreditFrequency.MONTHLY},
];

// ------------------------------
// Row Component (原有内容保持)
// ------------------------------
/* 原有 CreditRow 及其他编辑逻辑保持不变 ... */

type CreditRowProps = {
    credit: Credit;
    row: RowState;
    faceDollars: number;
    hasProportionDefault: boolean;
    isLastRow: boolean;
    onChange: (patch: Partial<RowState>, source?: LastEdited) => void;
    onBlur: (field: 'dollars' | 'proportion') => void;
    onClear: () => void;
};

const CreditRow: React.FC<CreditRowProps> = ({
                                                 credit,
                                                 row,
                                                 faceDollars,
                                                 hasProportionDefault,
                                                 isLastRow,
                                                 onChange,
                                                 onBlur,
                                                 onClear,
                                             }) => {
    const creditId = credit.creditId ?? '';
    const showClear = (row.explanation?.trim().length ?? 0) > 0;

    const theme = useTheme();
    const isSmUp = useMediaQuery(theme.breakpoints.up('sm'));

    const dollarsHelperText = row.dollarsError
        ? row.dollarsError
        : (isSmUp && row.proportionError ? ' ' : '');

    const proportionHelperText = row.proportionError
        ? row.proportionError
        : (isSmUp && row.dollarsError ? ' ' : '');

    return (
        <Box key={creditId}>
            <Grid container alignItems="center" spacing={1}>
                <Grid size={{xs: 12, md: 6}}>
                    <Typography variant="subtitle2" sx={{wordBreak: 'break-word'}}>
                        {credit.details || creditId || '未命名报销'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                        面值（年）约：$
                        {Number.isInteger(faceDollars) ? faceDollars : faceDollars.toFixed(2)}
                        {hasProportionDefault &&
                            ` · 默认等效比例：${(credit.defaultEffectiveValueProportion).toFixed(2)}`}
                    </Typography>
                </Grid>

                <Grid size={{xs: 12, md: 6}}>
                    <Grid container spacing={1} alignItems="center">
                        <Grid size={{xs: 12, sm: 6}}>
                            <TextField
                                size="small"
                                fullWidth
                                autoComplete="off"
                                label="美元（年）"
                                placeholder={`(0 - ${Number.isInteger(faceDollars) ? faceDollars : faceDollars.toFixed(2)})`}
                                value={row.dollarsInput}
                                onChange={(e) => onChange({dollarsInput: e.target.value}, 'dollars')}
                                onBlur={() => onBlur('dollars')}
                                error={!!row.dollarsError}
                                helperText={dollarsHelperText}
                                slotProps={{
                                    input: {
                                        startAdornment: <InputAdornment position="start">$</InputAdornment>,
                                        inputMode: 'decimal',
                                    },
                                }}
                            />
                        </Grid>

                        <Grid size={{xs: 12, sm: 6}}>
                            <TextField
                                size="small"
                                fullWidth
                                autoComplete="off"
                                label="等效比例 (0-1)"
                                placeholder="例如：0.75"
                                value={row.proportionInput}
                                onChange={(e) => onChange({proportionInput: e.target.value}, 'proportion')}
                                onBlur={() => onBlur('proportion')}
                                error={!!row.proportionError}
                                helperText={proportionHelperText}
                                slotProps={{
                                    input: {
                                        inputMode: 'decimal',
                                    },
                                }}
                            />
                        </Grid>

                        <Grid size={{xs: 12}}>
                            <TextField
                                size="small"
                                fullWidth
                                label="说明（可选）"
                                placeholder={`如：${credit.defaultEffectiveValueExplanation ?? ''}`}
                                value={row.explanation}
                                onChange={(e) => onChange({explanation: e.target.value})}
                                slotProps={{
                                    input: showClear
                                        ? {
                                            endAdornment: (
                                                <InputAdornment position="end">
                                                    <Tooltip title="清空此行">
                                                        <IconButton aria-label="clear row" size="small"
                                                                    onClick={onClear}>
                                                            <ClearIcon fontSize="small"/>
                                                        </IconButton>
                                                    </Tooltip>
                                                </InputAdornment>
                                            ),
                                        }
                                        : undefined,
                                }}
                            />
                        </Grid>
                    </Grid>
                </Grid>
            </Grid>
            {!isLastRow && <Divider sx={{my: 1}}/>}
        </Box>
    );
};

// ------------------------------
// 主组件（仅展示与自定义报销相关的新逻辑）
// ------------------------------
const CardEditComponent: React.FC<CardEditProps> = ({
                                                        open,
                                                        card,
                                                        displayCredits,
                                                        initialValuation,
                                                        onClose,
                                                        onSave,
                                                        singleCreditIdToEdit,
                                                    }) => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

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
            result.set(creditId, calculateRawAnnualCents(creditItem));
        }
        return result;
    }, [credits]);

    // 行状态：按 creditId 保存
    const [rowStateByCreditId, setRowStateByCreditId] = React.useState<Record<string, RowState>>({});

    // 本次打开会话的渲染顺序（只在打开时计算一次；编辑过程中不变）
    const [sessionCredits, setSessionCredits] = React.useState<Credit[]>(credits);

    // 初始化/重置表单 + 会话内排序（基于 initialValuation 是否有编辑痕迹来置顶）
    React.useEffect(() => {
        if (!open) return;

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
        } else {
            // 否则，采用父组件传入的顺序
            setSessionCredits(credits);
        }
    }, [open, credits, rawAnnualFaceCentsByCreditId, initialValuation, singleCreditIdToEdit]);

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

    // 表单是否存在错误
    const hasAnyError = React.useMemo(() => {
        return Object.values(rowStateByCreditId).some(
            (r) => !!r.dollarsError || !!r.proportionError,
        );
    }, [rowStateByCreditId]);

    // 自定义报销 state 初始化与同步（camelCase：customAdjustments）
    const [customAdjustments, setCustomAdjustments] = useState<uservaluation.v1.ICustomAdjustment[]>(
        initialValuation?.customAdjustments ? [...initialValuation.customAdjustments] : [],
    );

    // 当对话框“打开”时，用最新的 initialValuation 重置草稿，确保取消不会保留未保存的编辑
    useEffect(() => {
        if (open) {
            setCustomAdjustments(initialValuation?.customAdjustments ? [...initialValuation.customAdjustments] : []);
            // 如有其他草稿 state（例如各个 credit 的行编辑缓存），在这里同样重置
            // setRows(buildRowsFrom(initialValuation));
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

    const renderCustomAdjustments = () => (
        <Stack spacing={2}>
            {customAdjustments.map((item) => {
                const dollars = (item.valueCents ?? 0) / 100;
                const dollarsStr = Number.isFinite(dollars) ? dollars.toFixed(2) : '0.00';
                const id = item.customAdjustmentId ?? '';
                // @ts-ignore wrong identification?
                const frequency = item.frequency && item.frequency !== CreditFrequency.FREQUENCY_UNSPECIFIED
                    ? item.frequency
                    : CreditFrequency.ANNUAL;
                return (
                    <Box key={id} sx={{p: 1.5, borderRadius: 1, border: '1px solid', borderColor: 'divider'}}>
                        <Grid container spacing={2} alignItems="center">
                            <Grid size={{xs: 12, sm: 6}}>
                                <TextField
                                    fullWidth
                                    label="描述"
                                    value={item.description ?? ''}
                                    onChange={(e) =>
                                        handleUpdateCustomAdjustment(id, {description: e.target.value})
                                    }
                                    size="small"
                                />
                            </Grid>

                            <Grid size={{xs: 12, sm: 3}}>
                                <FormControl fullWidth size="small">
                                    <InputLabel id={`freq-${id}`}>频率</InputLabel>
                                    <Select
                                        labelId={`freq-${id}`}
                                        label="频率"
                                        value={frequency}
                                        onChange={(e) =>
                                            handleUpdateCustomAdjustment(
                                                id,
                                                {frequency: Number(e.target.value) as cardverdict.v1.CreditFrequency},
                                            )
                                        }
                                    >
                                        {frequencyOptions.map(opt => (
                                            <MenuItem key={opt.value} value={opt.value}>
                                                {opt.label}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>

                            <Grid size={{xs: 12, sm: 3}}>
                                <TextField
                                    fullWidth
                                    label="金额（美元，可为负）"
                                    value={dollarsStr}
                                    onChange={(e) => {
                                        const v = e.target.value;
                                        const vr = validateSignedDollars(v);
                                        if (!vr.ok || !vr.cleaned) {
                                            // 直接回显输入，不更新 valueCents，避免跳动
                                            handleUpdateCustomAdjustment(id, {valueCents: item.valueCents});
                                        } else {
                                            const num = Number(vr.cleaned);
                                            handleUpdateCustomAdjustment(id, {valueCents: Math.round(num * 100)});
                                        }
                                    }}
                                    InputProps={{
                                        startAdornment: <InputAdornment position="start">$</InputAdornment>,
                                    }}
                                    size="small"
                                />
                            </Grid>

                            <Grid size={{xs: 12}}>
                                <TextField
                                    fullWidth
                                    label="备注（可选）"
                                    value={item.notes ?? ''}
                                    onChange={(e) =>
                                        handleUpdateCustomAdjustment(id, {notes: e.target.value})
                                    }
                                    size="small"
                                    multiline
                                    minRows={1}
                                    maxRows={4}
                                />
                            </Grid>

                            <Grid size={{xs: 12}} display="flex" justifyContent="flex-end">
                                <Tooltip title="删除此自定义报销">
                                    <IconButton
                                        color="error"
                                        onClick={() => handleDeleteCustomAdjustment(id)}
                                        size="small"
                                    >
                                        <DeleteIcon fontSize="small"/>
                                    </IconButton>
                                </Tooltip>
                            </Grid>
                        </Grid>
                    </Box>
                );
            })}
        </Stack>
    );

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

    // 保存时将 customAdjustments 写回（camelCase）
    const handleSave = () => {
        const base: UserCardValuation = initialValuation ? {...initialValuation} : emptyValuation();
        base.customAdjustments = customAdjustments;
        onSave?.(base);
        onClose();
    };


    // 会话内冻结的标题，防止关闭动画期间因 props 变化造成闪动
    const [sessionTitle, setSessionTitle] = React.useState<string>('');

    React.useEffect(() => {
        if (open) {
            setSessionTitle(`编辑${singleCreditIdToEdit ? '单项' : ''}报销估值 — ${card.name}`);
        }
    }, [open]); // 仅在打开时锁定，避免关闭中因 props 更新而抖动

    // ------------------------------
    // Render
    // ------------------------------
    return (
        <Dialog fullScreen={isMobile} open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>{sessionTitle}</DialogTitle>
            <DialogContent dividers>

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

                <Divider sx={{my: 2}}/>

                <Box display="flex" alignItems="center" justifyContent="space-between" sx={{mb: 1}}>
                    <Typography variant="h6" component="div">
                        自定义报销
                    </Typography>
                    <Button variant="outlined" onClick={handleAddCustomAdjustment}>
                        添加自定义报销
                    </Button>
                </Box>

                {customAdjustments.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                        暂无自定义报销。点击“添加自定义报销”新建一条。
                    </Typography>
                ) : (
                    renderCustomAdjustments()
                )}
            </DialogContent>

            <DialogActions>
                <Typography variant="caption" color={hasAnyError ? 'error' : 'text.secondary'} sx={{mr: 'auto'}}>
                    {hasAnyError ? '存在无效输入，请修正后再保存' : ' '}
                </Typography>
                <Button onClick={onClose}>取消</Button>
                <Button variant="contained" onClick={handleSave} disabled={hasAnyError}>保存</Button>
            </DialogActions>
        </Dialog>
    );
};

export default CardEditComponent;
