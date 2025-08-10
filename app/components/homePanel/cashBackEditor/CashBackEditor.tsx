import React, {useEffect, useMemo} from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Stack,
    TextField,
    Typography,
    Grid,
    Box,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    InputAdornment, Divider, Alert, useMediaQuery, useTheme,
} from '@mui/material';
import {cardverdict, userprofile} from '~/generated/bundle';
import {FormProvider, useFieldArray, useForm, Controller} from 'react-hook-form';

// 为了方便访问，进行解构
const {EarningRate, CreditFrequency} = cardverdict.v1;
type IEarningRate = cardverdict.v1.IEarningRate;
type IPlannedSpending = userprofile.v1.IPlannedSpending;
type IUserCardValuation = userprofile.v1.IUserCardValuation;
type IValuationProfile = userprofile.v1.IValuationProfile;


// --- 辅助函数和常量 ---

const frequencyOptions: Array<{ label: string; value: cardverdict.v1.CreditFrequency }> = [
    {label: '每年总计', value: CreditFrequency.ANNUAL},
    {label: '每半年总计', value: CreditFrequency.SEMI_ANNUAL},
    {label: '每季度总计', value: CreditFrequency.QUARTERLY},
    {label: '每月总计', value: CreditFrequency.MONTHLY},
];

const periodsInYearFor = (frequency?: cardverdict.v1.CreditFrequency): number => {
    switch (frequency) {
        case CreditFrequency.ANNUAL:
            return 1;
        case CreditFrequency.SEMI_ANNUAL:
            return 2;
        case CreditFrequency.QUARTERLY:
            return 4;
        case CreditFrequency.MONTHLY:
            return 12;
        default:
            return 1;
    }
};


const getCategoryName = (category?: cardverdict.v1.EarningRate.SpendingCategory): string => {
    switch (category) {
        case EarningRate.SpendingCategory.TRAVEL:
            return '综合旅行';
        case EarningRate.SpendingCategory.FLIGHT:
            return '机票';
        case EarningRate.SpendingCategory.HOTEL:
            return '酒店';
        case EarningRate.SpendingCategory.CAR_RENTAL:
            return '租车';
        case EarningRate.SpendingCategory.CRUISE:
            return '邮轮';
        case EarningRate.SpendingCategory.DINING:
            return '餐饮';
        case EarningRate.SpendingCategory.GROCERY_STORES:
            return '超市';
        case EarningRate.SpendingCategory.STREAMING_SERVICES:
            return '流媒体';
        case EarningRate.SpendingCategory.TRANSIT:
            return '交通';
        case EarningRate.SpendingCategory.GAS_STATIONS:
            return '加油';
        case EarningRate.SpendingCategory.PHARMACIES:
            return '药店';
        case EarningRate.SpendingCategory.ALL_OTHER:
            return '所有其他消费';
        default:
            return '无类别';
    }
};

const formatEarningRate = (rate: IEarningRate): string => {
    const {multiplier, category, channel, qualifyingMerchants, notes} = rate;
    const categoryName = getCategoryName(category);
    let description = `${multiplier}x ${categoryName}`;

    if (channel === EarningRate.Channel.DIRECT) {
        description += ' (直接预定)';
    } else if (channel === EarningRate.Channel.TRAVEL_PORTAL) {
        description += ' (旅行门户)';
    } else if (channel === EarningRate.Channel.SPECIFIC_MERCHANTS && qualifyingMerchants && qualifyingMerchants.length > 0) {
        description += ` (${qualifyingMerchants.join(', ')})`;
    }

    if (notes) {
        description += ` - ${notes}`;
    }
    return description;
};

// --- React Hook Form 型定义 ---
type FormValues = {
    cppInput: string;
    spendings: Array<{
        earningRateId: string;
        amountInput: string;
        frequency: cardverdict.v1.CreditFrequency;
        notes: string;
        // 静态数据，仅用于UI显示
        _description: string;
        _multiplier: number;
    }>;
};

// --- 验证函数 ---
const validateNonNegative = (value: string): true | string => {
    if (value === null || value === undefined || String(value).trim() === '') {
        return true; // 允许空值，视为空消费
    }
    if (!/^\d*\.?\d{0,2}$/.test(value)) {
        return '必须是正数，最多两位小数';
    }
    return true;
};


// --- 组件 ---

type CashBackEditorProps = {
    open: boolean;
    onClose: () => void;
    card: cardverdict.v1.ICreditCard;
    initialCardValuation?: IUserCardValuation;
    initialPointSystemValuations?: IValuationProfile['pointSystemValuations'];
    onSave: (updates: {
        cardValuation: IUserCardValuation,
        pointSystemValuations: IValuationProfile['pointSystemValuations']
    }) => void;
    netWorthCents: number;
};

const CashBackEditor: React.FC<CashBackEditorProps> = ({
                                                           open,
                                                           onClose,
                                                           card,
                                                           initialCardValuation,
                                                           initialPointSystemValuations,
                                                           onSave,
                                                           netWorthCents
                                                       }) => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    const methods = useForm<FormValues>({
        mode: 'onChange',
        defaultValues: {
            cppInput: '0.00',
            spendings: [],
        },
    });
    const {control, handleSubmit, watch, reset} = methods;

    const {fields} = useFieldArray({
        control,
        name: 'spendings',
    });

    const sortedEarningRates = useMemo(() =>
            [...(card.earningRates ?? [])].sort((a, b) => (b.multiplier ?? 0) - (a.multiplier ?? 0)),
        [card.earningRates]);


    useEffect(() => {
        if (open) {
            const systemId = card.pointSystemInfo?.systemId;
            let cpp = card.pointSystemInfo?.defaultCentsPerPoint ?? 0;
            if (systemId && initialPointSystemValuations?.[systemId]?.cents != null) {
                cpp = initialPointSystemValuations[systemId].cents!;
            }

            const initialSpendings = sortedEarningRates.map(rate => {
                const earningRateId = rate.earningRateId!;
                const savedSpending = initialCardValuation?.plannedSpending?.[earningRateId];
                const amountCents = savedSpending?.amountCents ?? 0;

                return {
                    earningRateId: earningRateId,
                    amountInput: (amountCents / 100).toFixed(2),
                    frequency: savedSpending?.frequency ?? CreditFrequency.ANNUAL,
                    notes: savedSpending?.notes ?? '',
                    _description: formatEarningRate(rate),
                    _multiplier: rate.multiplier ?? 0,
                };
            });

            reset({
                cppInput: (cpp / 100).toFixed(2),
                spendings: initialSpendings,
            });
        }
    }, [open, card, initialCardValuation, initialPointSystemValuations, sortedEarningRates, reset]);

    const watchedValues = watch();

    const {
        totalAnnualSpend,
        totalReturnValue,
        effectiveReturnRate,
        spendReturnRate,
        netWorthEffectRate,
    } = useMemo(() => {
        const cpp = parseFloat(watchedValues.cppInput) || 0;
        const netWorth = netWorthCents || 0;

        let totalAnnualSpendCents = 0;
        let rewardsFromSpendCents = 0;

        (watchedValues.spendings ?? []).forEach(spending => {
            if (!spending) return;

            const periods = periodsInYearFor(spending.frequency);
            const amountCents = Math.round((parseFloat(spending.amountInput) || 0) * 100);
            const annualAmountCents = amountCents * periods;
            const multiplier = spending._multiplier ?? 0;

            totalAnnualSpendCents += annualAmountCents;
            rewardsFromSpendCents += (annualAmountCents * multiplier * cpp) / 100;
        });


        // 修正：当没有spendings时，也计算netWorth的影响
        const totalValueCents = rewardsFromSpendCents + netWorth;
        if (totalAnnualSpendCents === 0) {
            return {
                totalAnnualSpend: 0,
                totalReturnValue: totalValueCents / 100,
                effectiveReturnRate: 0, // No spend, so rate is 0, but value can exist from net worth
                spendReturnRate: 0,
                netWorthEffectRate: 0,
            };
        }


        const effectiveReturnRate = (totalValueCents / totalAnnualSpendCents) * 100;
        const spendReturnRate = (rewardsFromSpendCents / totalAnnualSpendCents) * 100;
        const netWorthEffectRate = (netWorth / totalAnnualSpendCents) * 100;

        return {
            totalAnnualSpend: totalAnnualSpendCents / 100,
            totalReturnValue: totalValueCents / 100,
            effectiveReturnRate,
            spendReturnRate,
            netWorthEffectRate,
        };
    }, [watchedValues, netWorthCents]);


    const onSubmit = (data: FormValues) => {
        const parsedCpp = parseFloat(data.cppInput);
        if (isNaN(parsedCpp)) {
            console.error("输入的每点价值 (cpp) 无效。");
            return;
        }

        const newPointSystemValuations = {...(initialPointSystemValuations ?? {})};
        const systemId = card.pointSystemInfo?.systemId;
        if (systemId) {
            newPointSystemValuations[systemId] = {
                cents: Math.round(parsedCpp * 100)
            };
        }

        const plannedSpendingResult: Record<string, IPlannedSpending> = {};
        data.spendings.forEach(s => {
            const amount = parseFloat(s.amountInput) || 0;
            plannedSpendingResult[s.earningRateId] = {
                lastKnownRuleDescription: s._description,
                lastKnownMultiplier: s._multiplier,
                amountCents: Math.round(amount * 100),
                frequency: s.frequency,
                notes: s.notes,
            };
        });

        const updatedCardValuation: IUserCardValuation = {
            ...(initialCardValuation ?? {}),
            plannedSpending: plannedSpendingResult,
        };

        onSave({
            cardValuation: updatedCardValuation,
            pointSystemValuations: newPointSystemValuations
        });
        onClose();
    };

    return (
        <FormProvider {...methods}>
            <Dialog
                open={open}
                onClose={onClose}
                fullScreen={isMobile}
                maxWidth="md"
                fullWidth
                PaperProps={{
                    sx: {
                        height: {sm: '90vh'},
                        width: {sm: '100vw'},
                    }
                }}
            >
                <DialogTitle>计算 {card.name} 返现</DialogTitle>

                <Box sx={{px: 3, mb: 2, mt: -1.5}}>
                    <Alert severity={effectiveReturnRate > 0 ? "success" : "warning"}
                           sx={{py: 1.5, '& .MuiAlert-message': {width: '100%'}}}>
                        <Stack spacing={1}>
                            <Grid container alignItems="center" justifyContent="space-around" spacing={1}>
                                <Grid size={4} textAlign="center">
                                    <Typography variant="caption" color="text.secondary"
                                                display="block">总消费</Typography>
                                    <Typography
                                        variant="h6" fontWeight="bold">${totalAnnualSpend.toFixed(0)}</Typography>
                                </Grid>
                                <Grid size={4} textAlign="center">
                                    <Typography variant="caption" color="text.secondary"
                                                display="block">总返现率</Typography>
                                    <Typography variant="h6" fontWeight="bold"
                                                sx={{color: effectiveReturnRate > 0 ? 'success.main' : 'error.main'}}>
                                        {effectiveReturnRate.toFixed(2)}%
                                    </Typography>
                                </Grid>
                                <Grid size={4} textAlign="center">
                                    <Typography variant="caption" color="text.secondary"
                                                display="block">总返现</Typography>
                                    <Typography variant="h6" fontWeight="bold"
                                                sx={{color: totalReturnValue >= 0 ? 'success.main' : 'error.main'}}>
                                        ${totalReturnValue.toFixed(0)}
                                    </Typography>
                                </Grid>
                            </Grid>
                            <Divider/>
                            <Typography variant="caption" color="text.secondary" display="block"
                                        textAlign="center">
                                总返现率 = 消费回报 {spendReturnRate.toFixed(2)}% +
                                净值影响 {netWorthEffectRate.toFixed(2)}%
                            </Typography>
                        </Stack>
                    </Alert>
                </Box>

                {/* 关键改动：form 只包裹 DialogContent，并通过 id 与外部按钮关联 */}
                <DialogContent dividers sx={{
                    pt: 0,
                    pb: {xs: 'calc(72px + env(safe-area-inset-bottom))', sm: 2}
                }}>
                    <form id="cash-back-form" onSubmit={handleSubmit(onSubmit)}>
                        <Stack>
                            <Box sx={{py: 2}}>
                                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                                    积分价值估算
                                </Typography>
                                <Controller
                                    name="cppInput"
                                    control={control}
                                    rules={{
                                        required: '价值不能为空',
                                        validate: validateNonNegative,
                                    }}
                                    render={({field, fieldState: {error}}) => (
                                        <TextField
                                            {...field}
                                            fullWidth
                                            label="每点价值 (cpp)"
                                            type="number"
                                            slotProps={{
                                                input: {
                                                    endAdornment: <InputAdornment position="end">¢/pt</InputAdornment>,
                                                },
                                                htmlInput: {
                                                    step: 0.1,
                                                    min: 0,
                                                    inputMode: 'decimal',
                                                }
                                            }}
                                            size="small"
                                            error={!!error}
                                            helperText={error?.message || card.pointSystemInfo?.notes || '输入你认为的此卡积分价值，用于计算返现等效金额'}
                                        />
                                    )}
                                />
                            </Box>

                            {fields.length > 0 && <Divider/>}

                            {fields.map((field, index) => (
                                <React.Fragment key={field.id}>
                                    <Box sx={{py: 2}}>
                                        <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                                            {field._description}
                                        </Typography>
                                        <Grid container spacing={{xs: 2, md: 3}} columns={{xs: 4, sm: 8, md: 12}}
                                              alignItems="flex-start">
                                            <Grid size={{xs: 4, sm: 4, md: 4}}>
                                                <Controller
                                                    name={`spendings.${index}.amountInput`}
                                                    control={control}
                                                    rules={{validate: validateNonNegative}}
                                                    render={({field: controllerField, fieldState: {error}}) => (
                                                        <TextField
                                                            {...controllerField}
                                                            fullWidth
                                                            label="计划消费额"
                                                            type="number"
                                                            error={!!error}
                                                            helperText={error?.message || ' '}
                                                            slotProps={{
                                                                input: {
                                                                    startAdornment: <InputAdornment
                                                                        position="start">$</InputAdornment>,
                                                                },
                                                                htmlInput: {
                                                                    min: 0,
                                                                    step: "10",
                                                                }
                                                            }}
                                                            size="small"
                                                        />
                                                    )}
                                                />
                                            </Grid>
                                            <Grid size={{xs: 4, sm: 4, md: 4}}>
                                                <Controller
                                                    name={`spendings.${index}.frequency`}
                                                    control={control}
                                                    render={({field: controllerField}) => (
                                                        <FormControl fullWidth size="small">
                                                            <InputLabel
                                                                id={`freq-label-${field.id}`}>频率</InputLabel>
                                                            <Select
                                                                {...controllerField}
                                                                labelId={`freq-label-${field.id}`}
                                                                label="频率"
                                                            >
                                                                {frequencyOptions.map(opt => (
                                                                    <MenuItem key={opt.value} value={opt.value}>
                                                                        {opt.label}
                                                                    </MenuItem>
                                                                ))}
                                                            </Select>
                                                        </FormControl>
                                                    )}
                                                />
                                            </Grid>
                                            <Grid size={{xs: 4, sm: 8, md: 4}}>
                                                <Controller
                                                    name={`spendings.${index}.notes`}
                                                    control={control}
                                                    render={({field: controllerField}) => (
                                                        <TextField
                                                            {...controllerField}
                                                            fullWidth
                                                            label="备注 (可选)"
                                                            size="small"
                                                        />
                                                    )}
                                                />
                                            </Grid>
                                        </Grid>
                                    </Box>
                                    {index < fields.length - 1 && <Divider/>}
                                </React.Fragment>
                            ))}
                        </Stack>
                    </form>
                </DialogContent>
                <DialogActions sx={{
                    position: {xs: 'sticky', sm: 'static'},
                    bottom: 0,
                    bgcolor: 'background.paper',
                    borderTop: (t) => ({xs: `1px solid ${t.palette.divider}`, sm: 'none'}),
                    pb: {xs: `max(16px, env(safe-area-inset-bottom))`, sm: 2},
                    pt: {xs: 2, sm: 2},
                    px: {xs: 2, sm: 3},
                    justifyContent: 'flex-end',
                }}>
                    <Button onClick={onClose}>取消</Button>
                    {/* 关键改动：通过 form 属性关联表单 */}
                    <Button variant="contained" type="submit" form="cash-back-form">保存</Button>
                </DialogActions>
            </Dialog>
        </FormProvider>
    );
};

export default CashBackEditor;
