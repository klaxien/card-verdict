import React, {useEffect, useMemo, useState} from 'react';
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
    const [spendingMap, setSpendingMap] = useState<Record<string, IPlannedSpending>>({});
    const [cppInput, setCppInput] = useState<string>('0.00');

    useEffect(() => {
        if (open) {
            const systemId = card.pointSystemInfo?.systemId;
            let cpp = card.pointSystemInfo?.defaultCentsPerPoint ?? 0;
            if (systemId && initialPointSystemValuations?.[systemId]?.cents != null) {
                cpp = (initialPointSystemValuations[systemId].cents!) / 100.0;
            }
            setCppInput(cpp.toFixed(2));

            const initialMap = (card.earningRates ?? []).reduce((acc, rate) => {
                if (rate.earningRateId) {
                    const savedSpending = initialCardValuation?.plannedSpending?.[rate.earningRateId];
                    acc[rate.earningRateId] = {
                        lastKnownRuleDescription: formatEarningRate(rate),
                        lastKnownMultiplier: rate.multiplier ?? 0,
                        amountCents: savedSpending?.amountCents ?? 0,
                        frequency: savedSpending?.frequency ?? CreditFrequency.ANNUAL,
                        notes: savedSpending?.notes ?? '',
                    };
                }
                return acc;
            }, {} as Record<string, IPlannedSpending>);
            setSpendingMap(initialMap);
        }
    }, [open, card, initialCardValuation, initialPointSystemValuations]);

    const {
        totalAnnualSpend,
        totalReturnValue,
        effectiveReturnRate,
        spendReturnRate,
        netWorthEffectRate,
    } = useMemo(() => {
        const cpp = parseFloat(cppInput) || 0;
        const netWorth = netWorthCents || 0;

        let totalAnnualSpendCents = 0;
        let rewardsFromSpendCents = 0;

        for (const earningRateId in spendingMap) {
            const spending = spendingMap[earningRateId];
            if (!spending) continue;

            const periods = periodsInYearFor(spending.frequency);
            const annualAmountCents = (spending.amountCents ?? 0) * periods;
            const multiplier = spending.lastKnownMultiplier ?? 0;

            totalAnnualSpendCents += annualAmountCents;
            rewardsFromSpendCents += (annualAmountCents * multiplier * cpp) / 100;
        }

        if (totalAnnualSpendCents === 0) {
            return {
                totalAnnualSpend: 0,
                totalReturnValue: netWorth / 100,
                effectiveReturnRate: 0,
                spendReturnRate: 0,
                netWorthEffectRate: 0,
            };
        }

        const totalValueCents = rewardsFromSpendCents + netWorth;
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
    }, [spendingMap, cppInput, netWorthCents]);


    const handleUpdate = (earningRateId: string, patch: Partial<IPlannedSpending>) => {
        setSpendingMap(prev => ({
            ...prev,
            [earningRateId]: {...(prev[earningRateId] as object), ...patch},
        }));
    };

    const handleSave = () => {
        const parsedCpp = parseFloat(cppInput);
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

        const updatedCardValuation: IUserCardValuation = {
            creditValuations: initialCardValuation?.creditValuations ?? {},
            otherBenefitValuations: initialCardValuation?.otherBenefitValuations ?? {},
            customAdjustments: initialCardValuation?.customAdjustments ?? [],
            plannedSpending: spendingMap,
        };

        onSave({
            cardValuation: updatedCardValuation,
            pointSystemValuations: newPointSystemValuations
        });
        onClose();
    };

    const handleCppBlur = () => {
        const parsed = parseFloat(cppInput);
        if (Number.isFinite(parsed)) {
            setCppInput(parsed.toFixed(2));
        } else {
            const initialCpp = card.pointSystemInfo?.defaultCentsPerPoint ?? 0;
            setCppInput(initialCpp.toFixed(2));
        }
    };

    const sortedEarningRates = [...(card.earningRates ?? [])].sort((a, b) => (b.multiplier ?? 0) - (a.multiplier ?? 0));

    return (
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
                                <Typography variant="caption" color="text.secondary" display="block">总消费</Typography>
                                <Typography variant="h6" fontWeight="bold">${totalAnnualSpend.toFixed(0)}</Typography>
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
                                <Typography variant="caption" color="text.secondary" display="block">总返现</Typography>
                                <Typography variant="h6" fontWeight="bold"
                                            sx={{color: totalReturnValue >= 0 ? 'success.main' : 'error.main'}}>
                                    ${totalReturnValue.toFixed(0)}
                                </Typography>
                            </Grid>
                        </Grid>
                        <Divider/>
                        <Typography variant="caption" color="text.secondary" display="block" textAlign="center">
                            总返现率 = 消费回报 {spendReturnRate.toFixed(2)}% + 净值影响 {netWorthEffectRate.toFixed(2)}%
                        </Typography>
                    </Stack>
                </Alert>
            </Box>

            <DialogContent dividers sx={{
                pt: 0,
                pb: {xs: 'calc(72px + env(safe-area-inset-bottom))', sm: 2}
            }}>
                <Stack>
                    <Box sx={{py: 2}}>
                        <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                            积分价值估算
                        </Typography>
                        <TextField
                            fullWidth
                            label="每点价值 (cpp)"
                            type="number"
                            value={cppInput}
                            onChange={(e) => setCppInput(e.target.value)}
                            onBlur={handleCppBlur}
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
                            helperText={card.pointSystemInfo?.notes || '输入你认为的此卡积分价值，用于计算返现等效金额'}
                        />
                    </Box>

                    {sortedEarningRates.length > 0 && <Divider/>}

                    {sortedEarningRates.map((rate, index) => {
                        const earningRateId = rate.earningRateId ?? '';
                        if (!earningRateId) return null;

                        const currentSpending = spendingMap[earningRateId];
                        if (!currentSpending) return null;

                        return (
                            <React.Fragment key={earningRateId}>
                                <Box sx={{py: 2}}>
                                    <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                                        {formatEarningRate(rate)}
                                    </Typography>
                                    <Grid container spacing={{xs: 2, md: 3}} columns={{xs: 4, sm: 8, md: 12}}
                                          alignItems="center">
                                        <Grid size={{xs: 4, sm: 4, md: 4}}>
                                            <TextField
                                                fullWidth
                                                label="计划消费额"
                                                type="number"
                                                value={(currentSpending.amountCents ?? 0) / 100}
                                                onChange={(e) => {
                                                    const value = parseFloat(e.target.value);
                                                    handleUpdate(earningRateId, {amountCents: isNaN(value) ? 0 : Math.round(value * 100)});
                                                }}
                                                slotProps={{
                                                    input: {
                                                        startAdornment: <InputAdornment
                                                            position="start">$</InputAdornment>,
                                                        min: 0,
                                                        step: "10",
                                                    },
                                                }}
                                                size="small"
                                            />
                                        </Grid>
                                        <Grid size={{xs: 4, sm: 4, md: 4}}>
                                            <FormControl fullWidth size="small">
                                                <InputLabel id={`freq-label-${earningRateId}`}>频率</InputLabel>
                                                <Select
                                                    labelId={`freq-label-${earningRateId}`}
                                                    label="频率"
                                                    value={currentSpending.frequency ?? CreditFrequency.ANNUAL}
                                                    onChange={(e) =>
                                                        handleUpdate(
                                                            earningRateId,
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
                                        <Grid size={{xs: 4, sm: 8, md: 4}}>
                                            <TextField
                                                fullWidth
                                                label="备注 (可选)"
                                                value={currentSpending.notes ?? ''}
                                                onChange={(e) => handleUpdate(earningRateId, {notes: e.target.value})}
                                                size="small"
                                            />
                                        </Grid>
                                    </Grid>
                                </Box>
                                {index < sortedEarningRates.length - 1 && <Divider/>}
                            </React.Fragment>
                        );
                    })}
                </Stack>
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
                <Button variant="contained" onClick={handleSave}>保存</Button>
            </DialogActions>
        </Dialog>
    );
};

export default CashBackEditor;
