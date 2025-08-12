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
    Grid,
    InputAdornment,
    Stack,
    Tab,
    Tabs,
    TextField,
    Typography,
    useMediaQuery,
    useTheme,
} from '@mui/material';
import {Controller, FormProvider, useFieldArray, useForm} from 'react-hook-form';
// --- MODIFICATION: Import new proto definitions ---
import {cardverdict, userprofile} from '~/generated/bundle';
import {loadActiveValuationProfile} from '~/client/userSettingsPersistence';
import {formatWithoutTrailingZeroes} from '~/components/homePanel/utils/creditCardDisplayUtils';
import BreakevenAnalysisTab from './BreakevenAnalysisTab';
import {formatEarningRate, periodsInYearFor, validateCpp} from './cashBackUtils';
import {OfficialSpendingsEditor} from './OfficialSpendingsEditor';
import {CustomSpendingsEditor} from './CustomSpendingsEditor';

// --- MODIFICATION: Import new enum from userprofile ---
const {CreditFrequency} = cardverdict.v1;
const {SpendingCalculationMode} = userprofile.v1;

type IUserCardValuation = userprofile.v1.IUserCardValuation;
type IValuationProfile = userprofile.v1.IValuationProfile;
type IPlannedSpending = userprofile.v1.IPlannedSpending;
type ICustomPlannedSpending = userprofile.v1.ICustomPlannedSpending;
// --- MODIFICATION: Import settings interface ---
type IBreakevenAnalysisSettings = userprofile.v1.IBreakevenAnalysisSettings;

export type UnifiedSpendingField = {
    id: string;
    isCustom: boolean;
    description: string;
    multiplier: number;
    amountInput: string;
    frequency: cardverdict.v1.CreditFrequency;
    notes: string;
};

export type FormValues = {
    cppInput: string;
    spendings: UnifiedSpendingField[];
};

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
        <div role="tabpanel" hidden={value !== index} id={`tabpanel-${index}`}
             aria-labelledby={`tab-${index}`} {...other}>
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

    // --- MODIFICATION: State for Breakeven Analysis is "lifted" to the parent ---
    const [breakevenIncludeNetWorth, setBreakevenIncludeNetWorth] = useState(true);
    const [breakevenCalcModes, setBreakevenCalcModes] = useState<Record<string, userprofile.v1.SpendingCalculationMode>>({});
    const [initialBreakevenSettings, setInitialBreakevenSettings] = useState<IBreakevenAnalysisSettings | undefined>(undefined);

    const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => setTabIndex(newValue);

    const methods = useForm<FormValues>({mode: 'onChange', defaultValues: {cppInput: '', spendings: []}});
    const {control, handleSubmit, watch, reset, formState: {isDirty, isValid}} = methods;
    const {fields, append, remove} = useFieldArray({control, name: 'spendings'});

    const sortedEarningRates = useMemo(() =>
            [...(card.earningRates ?? [])].sort((a, b) => (b.multiplier ?? 0) - (a.multiplier ?? 0)),
        [card.earningRates]
    );

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

            // Initialize breakeven settings from saved data ---
            const savedSettings = initialCardValuation?.breakevenAnalysisSettings;

            // 保存初始状态，用于后续比较
            setInitialBreakevenSettings(savedSettings ?? undefined);

            // Defaults to true if no setting is saved yet.
            setBreakevenIncludeNetWorth(savedSettings?.includeEquivalentAnnualFee ?? true);
            setBreakevenCalcModes(savedSettings?.spendingCalculationModes ?? {});

            reset({
                cppInput: cppValue.toFixed(2),
                spendings: [...officialSpendings, ...customSpendings],
            });
        }
    }, [open, card, initialCardValuation, initialPointSystemValuations, sortedEarningRates, reset]);

    const isSettingsDirty = useMemo(() => {
        const initialInclude = initialBreakevenSettings?.includeEquivalentAnnualFee ?? true;
        if (breakevenIncludeNetWorth !== initialInclude) {
            return true;
        }

        const initialModes = initialBreakevenSettings?.spendingCalculationModes ?? {};
        const currentModes = breakevenCalcModes;

        // 比较两个模式对象是否相同
        const initialKeys = Object.keys(initialModes);
        const currentKeys = Object.keys(currentModes);

        // 如果一个 spending 项被添加或删除，key 的数量会不同
        if (initialKeys.length !== currentKeys.length) {
            // 但这种情况会被 isDirty 捕获，为严谨起见保留
            return true;
        }

        // 检查每个 key 的值是否发生了变化
        for (const key of currentKeys) {
            // 如果一个 key 在旧对象中不存在，或者值不同，则为 "dirty"
            if (initialModes[key] !== currentModes[key]) {
                return true;
            }
        }

        return false;
    }, [breakevenIncludeNetWorth, breakevenCalcModes, initialBreakevenSettings]);

    const watchedValues = watch();

    const {
        totalAnnualSpend,
        totalReturnValue,
        effectiveReturnRate,
        spendReturnRate,
        netWorthEffectRate
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
        } else if (netWorth !== 0) {
            netWorthEffectRateResult = (netWorth / 100) * 100;
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
        if (isNaN(parsedCpp)) return;

        const newPointSystemValuations = {...(initialPointSystemValuations ?? {})};
        const systemId = card.pointSystemInfo?.systemId;
        if (systemId) {
            newPointSystemValuations[systemId] = {centsPerPoint: parsedCpp};
        }

        const plannedSpendingResult: Record<string, IPlannedSpending> = {};
        const customPlannedSpendingResult: ICustomPlannedSpending[] = [];

        data.spendings.forEach(s => {
            const amount = parseFloat(s.amountInput) || 0;
            if (s.isCustom) {
                if (s.description) {
                    customPlannedSpendingResult.push({
                        customSpendingId: s.id, description: s.description, multiplier: s.multiplier,
                        amountCents: Math.round(amount * 100), frequency: s.frequency, notes: s.notes,
                    });
                }
            } else {
                if (amount > 0) {
                    plannedSpendingResult[s.id] = {
                        amountCents: Math.round(amount * 100), frequency: s.frequency,
                        lastKnownRuleDescription: s.description, lastKnownMultiplier: s.multiplier, notes: s.notes,
                    };
                }
            }
        });

        // --- MODIFICATION: Construct the settings object to be saved ---
        const breakevenAnalysisSettings: IBreakevenAnalysisSettings = {
            includeEquivalentAnnualFee: breakevenIncludeNetWorth,
            spendingCalculationModes: breakevenCalcModes,
        };

        const updatedCardValuation: IUserCardValuation = {
            ...(initialCardValuation ?? {}),
            plannedSpending: plannedSpendingResult,
            customPlannedSpending: customPlannedSpendingResult,
            // --- MODIFICATION: Attach the settings to the card valuation object ---
            breakevenAnalysisSettings: breakevenAnalysisSettings,
        };

        onSave({cardValuation: updatedCardValuation, pointSystemValuations: newPointSystemValuations});
        onClose();
    };

    const handleConfirmClear = () => {
        if (!card.cardId) return;
        const profile = loadActiveValuationProfile() ?? {cardValuations: {}, pointSystemValuations: {}};
        const cardValuation = profile.cardValuations?.[card.cardId] ?? {};
        cardValuation.plannedSpending = {};
        cardValuation.customPlannedSpending = [];
        // --- MODIFICATION: Also clear the saved breakeven analysis settings ---
        cardValuation.breakevenAnalysisSettings = undefined;

        const systemId = card.pointSystemInfo?.systemId;
        const pointSystemValuations = profile.pointSystemValuations ?? {};
        if (systemId && pointSystemValuations[systemId]) {
            delete pointSystemValuations[systemId];
        }
        onSave({cardValuation, pointSystemValuations});
        setConfirmClearOpen(false);
        onClose();
    };

    return (
        <FormProvider {...methods}>
            <Dialog open={open} onClose={onClose} fullScreen={true} fullWidth>
                <DialogTitle>计算 {card.name} 返现</DialogTitle>
                <DialogContent dividers sx={{pt: 0, pb: {xs: `calc(72px + env(safe-area-inset-bottom))`, sm: 2}}}>
                    <Box sx={{borderBottom: 1, borderColor: 'divider'}}>
                        <Tabs value={tabIndex} onChange={handleTabChange} aria-label="返现计算标签页">
                            <Tab label="消费规划" id="tab-0" aria-controls="tabpanel-0"/>
                            <Tab label="盈亏平衡图表" id="tab-1" aria-controls="tabpanel-1"/>
                        </Tabs>
                    </Box>
                    <TabPanel value={tabIndex} index={0}>
                        <Box sx={{px: 3, my: 0}}>
                            <Alert icon={false} severity={effectiveReturnRate > 0 ? "success" : "warning"}
                                   sx={{pb: 1.5, '& .MuiAlert-message': {width: '100%'}}}>
                                <Stack spacing={1}>
                                    <Grid container alignItems="center" justifyContent="space-around" flexWrap="wrap"
                                          spacing={1}>
                                        <Grid size={3} textAlign="center"><Typography variant="caption"
                                                                                      color="text.secondary">总消费</Typography><Typography
                                            variant="h6"
                                            fontWeight="bold">${totalAnnualSpend.toFixed(0)}</Typography></Grid>
                                        <Grid size={3} textAlign="center"><Typography variant="caption"
                                                                                      color="text.secondary">总返现率</Typography><Typography
                                            variant="h6" fontWeight="bold"
                                            color={effectiveReturnRate > 0 ? 'success.main' : 'error.main'}>{formatWithoutTrailingZeroes(effectiveReturnRate)}%</Typography></Grid>
                                        <Grid size={3} textAlign="center"><Typography variant="caption"
                                                                                      color="text.secondary">纯消费返现率</Typography><Typography
                                            variant="h6" fontWeight="bold"
                                            color={spendReturnRate > 0 ? 'success.main' : 'error.main'}>{formatWithoutTrailingZeroes(spendReturnRate)}%</Typography></Grid>
                                        <Grid size={3} textAlign="center"><Typography variant="caption"
                                                                                      color="text.secondary">总返现</Typography><Typography
                                            variant="h6" fontWeight="bold"
                                            color={totalReturnValue >= 0 ? 'success.main' : 'error.main'}>${totalReturnValue.toFixed(0)}</Typography></Grid>
                                    </Grid>
                                    <Divider/>
                                    <Typography variant="caption" color="text.secondary" textAlign="center">
                                        总返现率 = 消费回报 {spendReturnRate.toFixed(2)}% +
                                        等效年费影响 {netWorthEffectRate.toFixed(2)}%
                                    </Typography>
                                </Stack>
                            </Alert>
                        </Box>
                        <form id="cash-back-form" onSubmit={handleSubmit(onSubmit)}>
                            <Box sx={{py: 2}}>
                                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>积分价值估算</Typography>
                                <Controller name="cppInput" control={control} rules={{validate: validateCpp}}
                                            render={({field, fieldState: {error}}) => (
                                                <TextField {...field} fullWidth label="每点价值 (cpp)"
                                                           autoComplete="off"
                                                           InputProps={{
                                                               endAdornment: <InputAdornment
                                                                   position="end">¢/pt</InputAdornment>
                                                           }}
                                                           inputProps={{inputMode: 'decimal'}} size="small"
                                                           error={!!error}
                                                           helperText={error?.message || card.pointSystemInfo?.notes || '输入你认为的此卡积分价值，用于计算返现等效金额'}/>
                                            )}/>
                            </Box>
                            <OfficialSpendingsEditor control={control} fields={fields}/>
                            <CustomSpendingsEditor control={control} fields={fields} remove={remove}
                                                   onAdd={handleAddCustomSpending}/>
                        </form>
                    </TabPanel>
                    <TabPanel value={tabIndex} index={1}>
                        {/* --- MODIFICATION: Pass state and setters to child component --- */}
                        <BreakevenAnalysisTab spendings={watchedValues.spendings} cppInput={watchedValues.cppInput}
                                              totalAnnualSpend={totalAnnualSpend} spendReturnRate={spendReturnRate}
                                              netWorthCents={netWorthCents}
                                              includeNetWorth={breakevenIncludeNetWorth}
                                              onIncludeNetWorthChange={setBreakevenIncludeNetWorth}
                                              calculationModes={breakevenCalcModes}
                                              onCalculationModeChange={setBreakevenCalcModes}
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
                            disabled={(!isDirty && !isSettingsDirty) || !isValid}>保存</Button>
                </DialogActions>
            </Dialog>
            <Dialog open={confirmClearOpen} onClose={() => setConfirmClearOpen(false)} maxWidth="xs">
                <DialogTitle>确认清空返现计算？</DialogTitle>
                <DialogContent>
                    <Typography>这将清除“{card.name}”的所有计划消费和自定义cpp。此操作不可撤销。</Typography>
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
