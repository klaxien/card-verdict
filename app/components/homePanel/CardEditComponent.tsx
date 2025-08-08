import React from 'react';
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
} from '@mui/material';
import ClearIcon from '@mui/icons-material/Clear';
import { cardverdict, uservaluation } from '~/generated/bundle';

type CustomValue = uservaluation.v1.ICustomValue;
type UserCardValuation = uservaluation.v1.IUserCardValuation;
type Credit = cardverdict.v1.ICredit;
type CreditCard = cardverdict.v1.ICreditCard;

type LastEdited = 'dollars' | 'proportion' | undefined;

type CardEditProps = {
    open: boolean;
    card: CreditCard;
    // 使用外部传入的展示顺序，确保与卡片UI一致
    displayCredits?: Credit[];
    initialValuation?: UserCardValuation;
    onClose: () => void;
    onSave?: (valuation: UserCardValuation) => void;
};

type RowState = {
    dollarsInput: string; // 文本框字符串（美元）
    proportionInput: string; // 文本框字符串（比例 0-1）
    explanation: string;
    lastEdited: LastEdited;
};

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

/**
 * 计算“年度面值”（raw annual，未应用默认等效比例）, 以分为单位
 */
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

const normalizeDollarString = (input: string): string => {
    if (input.trim() === '') return '';
    const numberValue = Number(input.replace(/,/g, ''));
    if (Number.isNaN(numberValue) || !Number.isFinite(numberValue)) return '';
    return numberValue.toFixed(2);
};

const normalizeProportionString = (input: string): string => {
    if (input.trim() === '') return '';
    const numberValue = Number(input);
    if (Number.isNaN(numberValue) || !Number.isFinite(numberValue)) return '';
    const clamped = Math.max(0, Math.min(1, numberValue));
    return clamped.toFixed(4);
};

/**
 * 基于来源字段联动另一字段
 */
const syncLinkedFieldBySource = (
    draftRow: RowState,
    lastEditedSource: LastEdited,
    annualFaceValueDollars: number,
): RowState => {
    const updated = { ...draftRow };

    if (lastEditedSource === 'dollars') {
        const dollarsNumber = Number(updated.dollarsInput);
        updated.proportionInput =
            updated.dollarsInput === '' ||
            Number.isNaN(dollarsNumber) ||
            !Number.isFinite(dollarsNumber) ||
            annualFaceValueDollars === 0
                ? ''
                : (dollarsNumber / annualFaceValueDollars).toString();
        updated.lastEdited = 'dollars';
    } else if (lastEditedSource === 'proportion') {
        const proportionNumber = Number(updated.proportionInput);
        updated.dollarsInput =
            updated.proportionInput === '' ||
            Number.isNaN(proportionNumber) ||
            !Number.isFinite(proportionNumber)
                ? ''
                : (proportionNumber * annualFaceValueDollars).toString();
        updated.lastEdited = 'proportion';
    }

    return updated;
};

/**
 * 失焦时的规范化与联动
 */
const normalizeRowOnBlur = (
    draftRow: RowState,
    field: 'dollars' | 'proportion',
    annualFaceValueDollars: number,
): RowState => {
    const updated = { ...draftRow };

    if (field === 'dollars') {
        const normalizedDollars = normalizeDollarString(updated.dollarsInput);
        updated.dollarsInput = normalizedDollars;
        updated.proportionInput =
            normalizedDollars && annualFaceValueDollars
                ? (Number(normalizedDollars) / annualFaceValueDollars).toString()
                : '';
        updated.lastEdited = 'dollars';
        return updated;
    }

    const normalizedProportion = normalizeProportionString(updated.proportionInput);
    updated.proportionInput = normalizedProportion;
    updated.dollarsInput =
        normalizedProportion && annualFaceValueDollars
            ? (Number(normalizedProportion) * annualFaceValueDollars).toFixed(2)
            : '';
    updated.lastEdited = 'proportion';
    return updated;
};

// ------------------------------
// Row Component
// ------------------------------

type CreditRowProps = {
    credit: Credit;
    row: RowState;
    faceDollars: number;
    hasProportionDefault: boolean;
    isLastRow: boolean; // 用于控制分割线显示
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

    return (
        <Box key={creditId}>
            <Grid container alignItems="center" spacing={1}>
                <Grid size={{ xs: 12, md: 6 }}>
                    <Typography variant="subtitle2" sx={{ wordBreak: 'break-word' }}>
                        {credit.details || creditId || '未命名报销'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                        面值（年）约：${faceDollars.toFixed(2)}
                        {hasProportionDefault &&
                            ` · 默认等效比例：${(credit.defaultEffectiveValueProportion as number).toFixed(2)}`}
                    </Typography>
                </Grid>

                <Grid size={{ xs: 12, md: 6 }}>
                    <Grid container spacing={1} alignItems="center">
                        <Grid size={{ xs: 12, sm: 6 }}>
                            <TextField
                                size="small"
                                fullWidth
                                label="美元（年）"
                                placeholder="例如：123.45"
                                value={row.dollarsInput}
                                onChange={(e) => onChange({ dollarsInput: e.target.value }, 'dollars')}
                                onBlur={() => onBlur('dollars')}
                                slotProps={{
                                    input: {
                                        startAdornment: <InputAdornment position="start">$</InputAdornment>,
                                        inputMode: 'decimal',
                                    },
                                }}
                            />
                        </Grid>

                        <Grid size={{ xs: 12, sm: 6 }}>
                            <TextField
                                size="small"
                                fullWidth
                                label="等效比例 (0-1)"
                                placeholder="例如：0.75"
                                value={row.proportionInput}
                                onChange={(e) => onChange({ proportionInput: e.target.value }, 'proportion')}
                                onBlur={() => onBlur('proportion')}
                                slotProps={{
                                    input: {
                                        inputMode: 'decimal',
                                    },
                                }}
                            />
                        </Grid>

                        <Grid size={{ xs: 12 }}>
                            <TextField
                                size="small"
                                fullWidth
                                label="说明（可选）"
                                placeholder={`如${credit.defaultEffectiveValueExplanation ?? ''}`}
                                value={row.explanation}
                                onChange={(e) => onChange({ explanation: e.target.value })}
                                slotProps={{
                                    input: showClear
                                        ? {
                                            endAdornment: (
                                                <InputAdornment position="end">
                                                    <Tooltip title="清空此行">
                                                        <IconButton aria-label="clear row" size="small" onClick={onClear}>
                                                            <ClearIcon fontSize="small" />
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
            {!isLastRow && <Divider sx={{ my: 1 }} />}
        </Box>
    );
};

// ------------------------------
// Main Component
// ------------------------------

const CardEditComponent: React.FC<CardEditProps> = ({
                                                        open,
                                                        card,
                                                        displayCredits,
                                                        initialValuation,
                                                        onClose,
                                                        onSave,
                                                    }) => {
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
                    ? (userCreditValuation.cents / 100 / annualFaceValueDollars).toFixed(4)
                    : '';
                nextStateByCreditId[creditId] = {
                    dollarsInput: dollars,
                    proportionInput: proportion,
                    explanation: userCreditValuation.explanation ?? '',
                    lastEdited: 'dollars',
                };
                continue;
            }

            if (userCreditValuation?.proportion != null) {
                const dollars = annualFaceValueDollars
                    ? (userCreditValuation.proportion * annualFaceValueDollars).toFixed(2)
                    : '';
                nextStateByCreditId[creditId] = {
                    dollarsInput: dollars,
                    proportionInput: String(userCreditValuation.proportion),
                    explanation: userCreditValuation.explanation ?? '',
                    lastEdited: 'proportion',
                };
                continue;
            }

            nextStateByCreditId[creditId] = {
                dollarsInput: '',
                proportionInput: '',
                explanation: '',
                lastEdited: undefined,
            };
        }

        setRowStateByCreditId(nextStateByCreditId);

        // 2) 计算“已编辑”置顶：仅基于 initialValuation 判定，保证在本次打开期间顺序不随实时输入改变
        const originalIndexById = new Map<string, number>();
        credits.forEach((c, i) => originalIndexById.set(c.creditId ?? `__idx_${i}`, i));

        const hasInitialEdited = (creditId: string): boolean => {
            const v = initialUserValuation.creditValuations?.[creditId];
            if (!v) return false;
            if (v.cents != null || v.proportion != null) return true;
            return (v.explanation?.trim()?.length ?? 0) > 0;
        };

        const sortedOnce = [...credits].sort((a, b) => {
            const idA = a.creditId ?? `__idx_${originalIndexById.get(a.creditId ?? '') ?? 0}`;
            const idB = b.creditId ?? `__idx_${originalIndexById.get(b.creditId ?? '') ?? 0}`;
            const editedA = hasInitialEdited(idA) ? 1 : 0;
            const editedB = hasInitialEdited(idB) ? 1 : 0;
            if (editedB !== editedA) return editedB - editedA; // 已编辑优先
            // 次级：保持原顺序
            const idxA = originalIndexById.get(a.creditId ?? '') ?? 0;
            const idxB = originalIndexById.get(b.creditId ?? '') ?? 0;
            return idxA - idxB;
        });

        setSessionCredits(sortedOnce);
    }, [open, credits, rawAnnualFaceCentsByCreditId, initialValuation]);

    // 行级操作封装
    const updateRow = React.useCallback(
        (creditId: string, patch: Partial<RowState>, source?: LastEdited) => {
            setRowStateByCreditId((previousState) => {
                const currentRowState: RowState =
                    previousState[creditId] ?? {
                        dollarsInput: '',
                        proportionInput: '',
                        explanation: '',
                        lastEdited: undefined,
                    };

                const annualFaceValueDollars = (rawAnnualFaceCentsByCreditId.get(creditId) ?? 0) / 100;
                const merged = syncLinkedFieldBySource({ ...currentRowState, ...patch }, source, annualFaceValueDollars);
                return { ...previousState, [creditId]: merged };
            });
        },
        [rawAnnualFaceCentsByCreditId],
    );

    const handleBlurRow = React.useCallback(
        (creditId: string, field: 'dollars' | 'proportion') => {
            setRowStateByCreditId((previousState) => {
                const currentRowState = previousState[creditId];
                if (!currentRowState) return previousState;

                const annualFaceValueDollars = (rawAnnualFaceCentsByCreditId.get(creditId) ?? 0) / 100;
                const normalized = normalizeRowOnBlur(currentRowState, field, annualFaceValueDollars);
                return { ...previousState, [creditId]: normalized };
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
            },
        }));
    }, []);

    // 保存：根据最后编辑字段写入 oneof（cents 或 proportion）
    const handleSave = React.useCallback(() => {
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

            if (rowState.lastEdited === 'dollars') {
                const dollarsNumber = Number(normalizeDollarString(rowState.dollarsInput));
                if (rowState.dollarsInput !== '' && Number.isFinite(dollarsNumber) && !Number.isNaN(dollarsNumber)) {
                    outputValuation.creditValuations![creditId] = {
                        cents: Math.round(dollarsNumber * 100),
                        explanation: rowState.explanation,
                    } as CustomValue;
                }
                continue;
            }

            if (rowState.lastEdited === 'proportion') {
                const proportionNumber = Number(normalizeProportionString(rowState.proportionInput));
                if (rowState.proportionInput !== '' && Number.isFinite(proportionNumber) && !Number.isNaN(proportionNumber)) {
                    outputValuation.creditValuations![creditId] = {
                        proportion: proportionNumber,
                        explanation: rowState.explanation,
                    } as CustomValue;
                }
            }

            // 未编辑或无效输入：保持默认（不写该项）
        }

        onSave?.(outputValuation);
        onClose();
    }, [credits, rowStateByCreditId, onClose, onSave]);

    // ------------------------------
    // Render
    // ------------------------------
    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
            <DialogTitle>编辑报销估值 — {card.name}</DialogTitle>
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
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>取消</Button>
                <Button variant="contained" onClick={handleSave}>
                    保存
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default CardEditComponent;
