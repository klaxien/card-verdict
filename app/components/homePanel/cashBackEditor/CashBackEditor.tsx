import React, {useEffect, useState} from 'react';
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
    InputAdornment, Divider,
} from '@mui/material';
import {cardverdict, userprofile} from '~/generated/bundle';

// 为了方便访问，进行解构
const {EarningRate, CreditFrequency} = cardverdict.v1;
type IEarningRate = cardverdict.v1.IEarningRate;
type IPlannedSpending = userprofile.v1.IPlannedSpending;

// --- 辅助函数和常量 ---

const frequencyOptions: Array<{ label: string; value: cardverdict.v1.CreditFrequency }> = [
    {label: '每年总计', value: CreditFrequency.ANNUAL},
    {label: '每半年总计', value: CreditFrequency.SEMI_ANNUAL},
    {label: '每季度总计', value: CreditFrequency.QUARTERLY},
    {label: '每月总计', value: CreditFrequency.MONTHLY},
];

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
    // 在一个真实的应用程序中，会传入用户的初始估值和一个保存处理器
    // initialValuation?: userprofile.v1.IUserCardValuation;
    // onSave: (updatedSpending: Record<string, IPlannedSpending>) => void;
};

const CashBackEditor: React.FC<CashBackEditorProps> = ({open, onClose, card}) => {
    // State 用于保存每个返现规则的计划支出
    const [spendingMap, setSpendingMap] = useState<Record<string, IPlannedSpending>>({});
    // 将CPP值作为字符串进行管理，以避免浮点数精度问题
    const [cppInput, setCppInput] = useState<string>('0.00');

    // 当对话框打开或卡片改变时，初始化或重置 state
    useEffect(() => {
        if (open) {
            // 设置CPP初始值，并格式化为两位小数的字符串
            const initialCpp = card.pointSystemInfo?.defaultCentsPerPoint ?? 0;
            setCppInput(initialCpp.toFixed(2));

            const initialMap: Record<string, IPlannedSpending> = {};
            for (const rate of card.earningRates ?? []) {
                if (rate.earningRateId) {
                    initialMap[rate.earningRateId] = {
                        amountCents: 0,
                        frequency: CreditFrequency.ANNUAL,
                        lastKnownRuleDescription: formatEarningRate(rate),
                        lastKnownMultiplier: rate.multiplier,
                    };
                }
            }
            setSpendingMap(initialMap);
        }
    }, [open, card]);

    const handleUpdate = (earningRateId: string, patch: Partial<IPlannedSpending>) => {
        setSpendingMap(prev => ({
            ...prev,
            [earningRateId]: {...(prev[earningRateId] as object), ...patch},
        }));
    };

    const handleCalculate = () => {
        const cppValue = parseFloat(cppInput);
        console.log("使用支出数据进行计算:", spendingMap, "以及CPP:", cppValue);
        onClose();
    };

    const handleCppBlur = () => {
        const parsed = parseFloat(cppInput);
        if (Number.isFinite(parsed)) {
            setCppInput(parsed.toFixed(2));
        } else {
            // 如果输入无效，则重置为初始值
            const initialCpp = card.pointSystemInfo?.defaultCentsPerPoint ?? 0;
            setCppInput(initialCpp.toFixed(2));
        }
    };

    // 为了更好的用户体验，按返现率从高到低排序
    const sortedEarningRates = [...(card.earningRates ?? [])].sort((a, b) => (b.multiplier ?? 0) - (a.multiplier ?? 0));

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
            <DialogTitle>计算 {card.name} 返现</DialogTitle>
            <DialogContent dividers>
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
            <DialogActions>
                <Button onClick={onClose}>取消</Button>
                <Button variant="contained" onClick={handleCalculate}>计算</Button>
            </DialogActions>
        </Dialog>
    );
};

export default CashBackEditor;
