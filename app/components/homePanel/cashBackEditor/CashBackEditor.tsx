import React, {useEffect, useMemo, useState} from 'react';
import {
    Alert,
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    FormControl,
    Grid,
    InputAdornment,
    InputLabel,
    MenuItem,
    Select,
    Stack,
    Tab,
    Tabs,
    TextField,
    Typography,
    useMediaQuery,
    useTheme,
} from '@mui/material';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import {cardverdict, userprofile} from '~/generated/bundle';
import {Controller, FormProvider, useFieldArray, useForm} from 'react-hook-form';
import {loadActiveValuationProfile} from "~/client/userSettingsPersistence";
import {createLengthValidator} from "~/components/common/validators";
import {formatWithoutTrailingZeroes} from "~/components/homePanel/utils/creditCardDisplayUtils";
import BreakevenAnalysisTab from "./BreakevenAnalysisTab"; // 假设 BreakevenAnalysisTab 在同一目录下

// 为了方便访问，进行解构
const {EarningRate, CreditFrequency} = cardverdict.v1;
type IEarningRate = cardverdict.v1.IEarningRate;
type IPlannedSpending = userprofile.v1.IPlannedSpending;
type IUserCardValuation = userprofile.v1.IUserCardValuation;
type IValuationProfile = userprofile.v1.IValuationProfile;
type ICustomPlannedSpending = userprofile.v1.ICustomPlannedSpending;


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
    const categoryName = getCategoryName(category ?? undefined);
    let description = `${multiplier}x ${categoryName}`;

    if (channel === EarningRate.Channel.DIRECT) {
        description += ' (直接预定)';
    } else if (channel === EarningRate.Channel.TRAVEL_PORTAL) {
        description += ' (Portal)';
    } else if (channel === EarningRate.Channel.SPECIFIC_MERCHANTS && qualifyingMerchants && qualifyingMerchants.length > 0) {
        description += ` (${qualifyingMerchants.join(', ')})`;
    }

    if (notes) {
        description += ` - ${notes}`;
    }
    return description;
};

// --- React Hook Form 的统一数据模型 ---
type UnifiedSpendingField = {
    id: string; // 将是 earningRateId 或 customSpendingId
    isCustom: boolean;
    description: string;
    multiplier: number;
    amountInput: string;
    frequency: cardverdict.v1.CreditFrequency;
    notes: string;
};

type FormValues = {
    cppInput: string;
    spendings: UnifiedSpendingField[];
};

// --- 验证函数 ---
const validateCpp = (value: string): true | string => {
    if (value === null || value === undefined || String(value).trim() === '') return '价值不能为空';
    if (!/^\d*\.?\d{0,2}$/.test(value)) {
        return '必须是正数，且最多两位小数';
    }
    return true;
};

const validateOptionalAmount = (value: string): true | string => {
    if (value === null || value === undefined || String(value).trim() === '') {
        return true; // 允许空值
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

interface TabPanelProps {
    children?: React.ReactNode;
    index: number;
    value: number;
}

function TabPanel(props: TabPanelProps) {
    const {children, value, index, ...other} = props;
    return (
        <div role="tabpanel" hidden={value !== index} id={`simple-tabpanel-${index}`}
             aria-labelledby={`simple-tab-${index}`} {...other}>
            {value === index && (<Box sx={{pt: 2}}>{children}</Box>)}
        </div>
    );
}

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
    const [confirmClearOpen, setConfirmClearOpen] = useState(false);
    const [tabIndex, setTabIndex] = useState(0);

    const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
        setTabIndex(newValue);
    };

    const methods = useForm<FormValues>({
        mode: 'onChange',
        defaultValues: {cppInput: '', spendings: []},
    });
    const {control, handleSubmit, watch, reset, formState: {isDirty, isValid}} = methods;

    const {fields, append, remove} = useFieldArray({control, name: 'spendings'});

    const sortedEarningRates = useMemo(() =>
            [...(card.earningRates ?? [])].sort((a, b) => (b.multiplier ?? 0) - (a.multiplier ?? 0)),
        [card.earningRates]);

    useEffect(() => {
        if (open) {
            setTabIndex(0);
            const systemId = card.pointSystemInfo?.systemId;
            let cppValue = card.pointSystemInfo?.defaultCentsPerPoint ?? 0;
            if (systemId && initialPointSystemValuations?.[systemId]?.centsPerPoint != null) {
                cppValue = initialPointSystemValuations[systemId].centsPerPoint!;
            }

            const officialSpendings: UnifiedSpendingField[] = sortedEarningRates.map(rate => {
                const savedSpending = initialCardValuation?.plannedSpending?.[rate.earningRateId!];
                return {
                    id: rate.earningRateId!,
                    isCustom: false,
                    description: formatEarningRate(rate),
                    multiplier: rate.multiplier ?? 0,
                    amountInput: savedSpending?.amountCents ? (savedSpending.amountCents / 100).toString() : '',
                    frequency: savedSpending?.frequency ?? CreditFrequency.ANNUAL,
                    notes: savedSpending?.notes ?? '',
                };
            });

            const customSpendings: UnifiedSpendingField[] = (initialCardValuation?.customPlannedSpending ?? []).map(custom => ({
                id: custom.customSpendingId!,
                isCustom: true,
                description: custom.description!,
                multiplier: custom.multiplier!,
                amountInput: custom.amountCents ? (custom.amountCents / 100).toString() : '',
                frequency: custom.frequency!,
                notes: custom.notes ?? '',
            }));

            reset({
                cppInput: cppValue.toFixed(2),
                spendings: [...officialSpendings, ...customSpendings],
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
            const multiplier = spending.multiplier ?? 0;

            totalAnnualSpendCents += annualAmountCents;
            rewardsFromSpendCents += (annualAmountCents * multiplier * cpp) / 100;
        });

        const totalValueCents = rewardsFromSpendCents + netWorth;

        let spendReturnRateResult = 0;
        let netWorthEffectRateResult = 0;
        let effectiveReturnRateResult = 0;

        if (totalAnnualSpendCents > 0) {
            spendReturnRateResult = (rewardsFromSpendCents / totalAnnualSpendCents) * 100;
            netWorthEffectRateResult = (netWorth / totalAnnualSpendCents) * 100;
            effectiveReturnRateResult = spendReturnRateResult + netWorthEffectRateResult;
        } else if (netWorth !== 0) { //  Handle both positive and negative netWorth when spend is 0
            const netWorthDollars = netWorth / 100;
            netWorthEffectRateResult = netWorthDollars * 100; // This results in a large percentage, which is the intended behavior.
            effectiveReturnRateResult = netWorthEffectRateResult;
        }

        return {
            totalAnnualSpend: totalAnnualSpendCents / 100,
            totalReturnValue: totalValueCents / 100,
            effectiveReturnRate: effectiveReturnRateResult,
            spendReturnRate: spendReturnRateResult,
            netWorthEffectRate: netWorthEffectRateResult,
        };
    }, [watchedValues, netWorthCents]);

    const handleAddCustomSpending = () => {
        append({
            id: crypto.randomUUID(),
            isCustom: true,
            description: '',
            multiplier: 1,
            amountInput: '',
            frequency: CreditFrequency.ANNUAL,
            notes: '',
        });
    };

    const onSubmit = (data: FormValues) => {
        const parsedCpp = parseFloat(data.cppInput);
        if (isNaN(parsedCpp)) {
            console.error("输入的每点价值 (cpp) 无效。");
            return;
        }
        const newPointSystemValuations = {...(initialPointSystemValuations ?? {})};
        const systemId = card.pointSystemInfo?.systemId;
        if (systemId) {
            newPointSystemValuations[systemId] = {centsPerPoint: parsedCpp};
        }

        const plannedSpendingResult: Record<string, IPlannedSpending> = {};
        const customPlannedSpendingResult: ICustomPlannedSpending[] = [];

        data.spendings.forEach(s => {
            const amount = parseFloat(s.amountInput) || 0;
            if (amount === 0 && s.isCustom) { // 如果是自定义项且金额为0，则不保存
                return;
            }

            if (s.isCustom) {
                customPlannedSpendingResult.push({
                    customSpendingId: s.id,
                    description: s.description,
                    multiplier: s.multiplier,
                    amountCents: Math.round(amount * 100),
                    frequency: s.frequency,
                    notes: s.notes,
                });
            } else {
                if (amount > 0) { // 只有当金额大于0时，才保存官方消费项
                    plannedSpendingResult[s.id] = {
                        amountCents: Math.round(amount * 100),
                        frequency: s.frequency,
                        lastKnownRuleDescription: s.description,
                        lastKnownMultiplier: s.multiplier,
                        notes: s.notes,
                    };
                }
            }
        });

        const updatedCardValuation: IUserCardValuation = {
            ...(initialCardValuation ?? {}),
            plannedSpending: plannedSpendingResult,
            customPlannedSpending: customPlannedSpendingResult,
        };
        console.log(updatedCardValuation);

        onSave({cardValuation: updatedCardValuation, pointSystemValuations: newPointSystemValuations});
        onClose();
    };

    const handleConfirmClear = () => {
        if (!card.cardId) {
            console.error("Cannot clear spending for a card without a cardId.");
            setConfirmClearOpen(false);
            return;
        }
        const profile = loadActiveValuationProfile() ?? {cardValuations: {}, pointSystemValuations: {}};
        const cardValuation = profile.cardValuations?.[card.cardId] ?? {};
        cardValuation.plannedSpending = {};
        cardValuation.customPlannedSpending = []; // 同样清空自定义消费
        const systemId = card.pointSystemInfo?.systemId;
        const pointSystemValuations = profile.pointSystemValuations ?? {};
        if (systemId && pointSystemValuations[systemId]) {
            delete pointSystemValuations[systemId];
        }
        onSave({cardValuation: cardValuation, pointSystemValuations: pointSystemValuations});
        setConfirmClearOpen(false);
        onClose();
    };

    return (
        <FormProvider {...methods}>
            <Dialog open={open} onClose={onClose} fullScreen={isMobile} maxWidth="md" fullWidth
                    PaperProps={{sx: {height: {sm: '90vh'}, width: {sm: '100vw'}}}}>
                <DialogTitle>计算 {card.name} 返现</DialogTitle>
                <Box sx={{px: 3, mb: 1, mt: -1.5}}>
                    <Alert icon={false} severity={effectiveReturnRate > 0 ? "success" : "warning"}
                           sx={{pb: 1.5, '& .MuiAlert-message': {width: '100%'}}}>
                        <Stack spacing={1}>
                            <Grid container alignItems="center" justifyContent="space-around" flexWrap="wrap"
                                  spacing={1}>
                                <Grid size={3} textAlign="center"><Typography variant="caption" color="text.secondary"
                                                                              display="block">总消费</Typography><Typography
                                    variant="h6" fontWeight="bold"
                                    sx={{wordBreak: 'break-word'}}>${totalAnnualSpend.toFixed(0)}</Typography></Grid>
                                <Grid size={3} textAlign="center"><Typography variant="caption" color="text.secondary"
                                                                              display="block">总返现率</Typography><Typography
                                    variant="h6" fontWeight="bold" sx={{
                                    color: effectiveReturnRate > 0 ? 'success.main' : 'error.main',
                                    wordBreak: 'break-word'
                                }}>{formatWithoutTrailingZeroes(effectiveReturnRate)}%</Typography></Grid>
                                <Grid size={3} textAlign="center"><Typography variant="caption" color="text.secondary"
                                                                              display="block">纯消费返现率</Typography><Typography
                                    variant="h6" fontWeight="bold" sx={{
                                    color: spendReturnRate > 0 ? 'success.main' : 'error.main',
                                    wordBreak: 'break-word'
                                }}>{formatWithoutTrailingZeroes(spendReturnRate)}%</Typography></Grid>
                                <Grid size={3} textAlign="center"><Typography variant="caption" color="text.secondary"
                                                                              display="block">总返现</Typography><Typography
                                    variant="h6" fontWeight="bold" sx={{
                                    color: totalReturnValue >= 0 ? 'success.main' : 'error.main',
                                    wordBreak: 'break-word'
                                }}>${totalReturnValue.toFixed(0)}</Typography></Grid>
                            </Grid>
                            <Divider/>
                            <Typography variant="caption" color="text.secondary" display="block" textAlign="center">
                                总返现率 = 消费回报 {spendReturnRate.toFixed(2)}%
                                +等效年费影响 {netWorthEffectRate.toFixed(2)}%
                            </Typography>
                        </Stack>
                    </Alert>
                </Box>
                <DialogContent dividers sx={{pt: 0, pb: {xs: `calc(72px + env(safe-area-inset-bottom))`, sm: 2}}}>
                    <Box sx={{borderBottom: 1, borderColor: 'divider'}}>
                        <Tabs value={tabIndex} onChange={handleTabChange} aria-label="analysis tabs">
                            <Tab label="消费规划"/>
                            <Tab label="盈亏平衡图表"/>
                        </Tabs>
                    </Box>
                    <TabPanel value={tabIndex} index={0}>
                        <form id="cash-back-form" onSubmit={handleSubmit(onSubmit)}>
                            <Stack>
                                <Box sx={{py: 2}}>
                                    <Typography variant="subtitle1" fontWeight="bold"
                                                gutterBottom>积分价值估算</Typography>
                                    <Controller name="cppInput" control={control} rules={{validate: validateCpp}}
                                                render={({field, fieldState: {error}}) => (
                                                    <TextField {...field} onBlur={(e) => {
                                                        field.onBlur();
                                                        const num = parseFloat(e.target.value);
                                                        if (Number.isFinite(num)) {
                                                            field.onChange(num.toFixed(2));
                                                        }
                                                    }} fullWidth label="每点价值 (cpp)" InputProps={{
                                                        endAdornment: <InputAdornment
                                                            position="end">¢/pt</InputAdornment>
                                                    }} inputProps={{inputMode: 'decimal'}} size="small" error={!!error}
                                                               helperText={error?.message || card.pointSystemInfo?.notes || '输入你认为的此卡积分价值，用于计算返现等效金额'}/>
                                                )}/>
                                </Box>
                                {fields.length > 0 && <Divider/>}
                                {fields.map((field, index) => (
                                    <React.Fragment key={field.id}>
                                        <Box sx={{py: 2}}>
                                            {field.isCustom ? (
                                                <Grid container spacing={2} alignItems="center" sx={{mb: 2}}>
                                                    <Grid item xs={12} sm={6}>
                                                        <Controller name={`spendings.${index}.description`}
                                                                    control={control} rules={{required: '描述不能为空'}}
                                                                    render={({field: descField, fieldState}) =>
                                                                        <TextField {...descField} fullWidth
                                                                                   label="自定义类别描述" size="small"
                                                                                   error={!!fieldState.error}
                                                                                   helperText={fieldState.error?.message}/>}/>
                                                    </Grid>
                                                    <Grid item xs={12} sm={4}>
                                                        <Controller name={`spendings.${index}.multiplier`}
                                                                    control={control}
                                                                    rules={{validate: v => parseFloat(String(v)) > 0 || '必须是正数'}}
                                                                    render={({field: multField, fieldState}) =>
                                                                        <TextField {...multField} fullWidth
                                                                                   label="返现乘数" type="number"
                                                                                   size="small" InputProps={{
                                                                            endAdornment: <InputAdornment
                                                                                position="end">x</InputAdornment>
                                                                        }} error={!!fieldState.error}
                                                                                   helperText={fieldState.error?.message}/>}/>
                                                    </Grid>
                                                    <Grid item xs={12} sm={2}>
                                                        <Button onClick={() => remove(index)}
                                                                color="error">删除</Button>
                                                    </Grid>
                                                </Grid>
                                            ) : (
                                                <Typography variant="subtitle1" fontWeight="bold"
                                                            gutterBottom>{field.description}</Typography>
                                            )}

                                            <Grid container spacing={{xs: 2, md: 3}} columns={{xs: 4, sm: 8, md: 12}}
                                                  alignItems="flex-start">
                                                <Grid size={{xs: 4, sm: 4, md: 4}}>
                                                    <Controller name={`spendings.${index}.amountInput`}
                                                                control={control}
                                                                rules={{validate: validateOptionalAmount}}
                                                                render={({
                                                                             field: controllerField,
                                                                             fieldState: {error}
                                                                         }) => (
                                                                    <TextField {...controllerField} onBlur={(e) => {
                                                                        controllerField.onBlur();
                                                                        const value = e.target.value.trim();
                                                                        if (value === '') {
                                                                            controllerField.onChange('');
                                                                            return;
                                                                        }
                                                                        const num = parseFloat(value);
                                                                        const roundedNum = Math.round(num * 100) / 100;
                                                                        controllerField.onChange(isNaN(roundedNum) ? '' : roundedNum.toString());
                                                                    }} fullWidth label="计划消费额" error={!!error}
                                                                               helperText={error?.message || ' '}
                                                                               InputProps={{
                                                                                   startAdornment: <InputAdornment
                                                                                       position="start">$</InputAdornment>
                                                                               }} inputProps={{min: 0}} size="small"/>
                                                                )}/>
                                                </Grid>
                                                <Grid size={{xs: 4, sm: 4, md: 4}}>
                                                    <Controller name={`spendings.${index}.frequency`} control={control}
                                                                render={({field: controllerField}) => (
                                                                    <FormControl fullWidth size="small"><InputLabel
                                                                        id={`freq-label-${field.id}`}>频率</InputLabel><Select {...controllerField}
                                                                                                                               labelId={`freq-label-${field.id}`}
                                                                                                                               label="频率">{frequencyOptions.map(opt => (
                                                                        <MenuItem key={opt.value}
                                                                                  value={opt.value}>{opt.label}</MenuItem>))}</Select></FormControl>
                                                                )}/>
                                                </Grid>
                                                <Grid size={{xs: 4, sm: 8, md: 4}}>
                                                    <Controller name={`spendings.${index}.notes`} control={control}
                                                                rules={{validate: createLengthValidator(50, '备注')}}
                                                                render={({
                                                                             field: controllerField,
                                                                             fieldState: {error}
                                                                         }) => (
                                                                    <TextField {...controllerField} fullWidth
                                                                               label="备注 (可选)" size="small"
                                                                               error={!!error}
                                                                               helperText={error?.message || ''}/>
                                                                )}/>
                                                </Grid>
                                            </Grid>
                                        </Box>
                                        {index < fields.length - 1 && <Divider/>}
                                    </React.Fragment>
                                ))}
                                <Box sx={{display: 'flex', justifyContent: 'center', py: 2}}>
                                    <Button startIcon={<AddCircleOutlineIcon/>} onClick={handleAddCustomSpending}>
                                        添加自定义消费类别
                                    </Button>
                                </Box>
                            </Stack>
                        </form>
                    </TabPanel>
                    <TabPanel value={tabIndex} index={1}>
                        <BreakevenAnalysisTab
                            spendings={watchedValues.spendings}
                            cppInput={watchedValues.cppInput}
                            totalAnnualSpend={totalAnnualSpend}
                            spendReturnRate={spendReturnRate}
                            netWorthCents={netWorthCents}
                        />
                    </TabPanel>
                </DialogContent>
                <DialogActions sx={{
                    position: {xs: 'sticky', sm: 'static'},
                    bottom: 0,
                    bgcolor: 'background.paper',
                    borderTop: (t) => ({xs: `1px solid ${t.palette.divider}`, sm: 'none'}),
                    pb: {xs: `max(16px, env(safe-area-inset-bottom))`, sm: 2},
                    pt: {xs: 2, sm: 2},
                    px: {xs: 2, sm: 3}
                }}>
                    <Button color="error" variant="text" onClick={() => setConfirmClearOpen(true)}>清空</Button>
                    <Box sx={{flexGrow: 1}}/>
                    <Button onClick={onClose}>取消</Button>
                    <Button variant="contained" type="submit" form="cash-back-form"
                            disabled={!isDirty || !isValid}>
                        保存
                    </Button>
                </DialogActions>
            </Dialog>
            <Dialog open={confirmClearOpen} onClose={() => setConfirmClearOpen(false)} maxWidth="xs">
                <DialogTitle>确认清空返现计算？</DialogTitle>
                <DialogContent>
                    <Typography>
                        这将清除“{card.name}”的所有计划消费和自定义cpp，但不清除自定义估值。此操作不可撤销。
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setConfirmClearOpen(false)}>取消</Button>
                    <Button color="error" variant="contained" onClick={handleConfirmClear}>确认清空</Button>
                </DialogActions>
            </Dialog>
        </FormProvider>
    );
};

export default CashBackEditor;
