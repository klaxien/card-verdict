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
import {FormProvider, useFieldArray, useForm} from 'react-hook-form';
import {cardverdict, userprofile} from '~/generated/bundle';
import {calcRawAnnualCents} from '~/utils/cardCalculations';
import {CustomAdjustmentsEditor} from './CustomAdjustmentsEditor';
import {loadActiveValuationProfile, saveValuationProfile} from '~/client/userSettingsPersistence';
import {BenefitRow} from "./BenefitRow";
import {CreditRow} from "./CreditRow";
import {shouldHideBenefit} from "~/components/homePanel/utils/creditCardDisplayUtils";

// Type Definitions
type PerkValue = userprofile.v1.IPerkValue;
type UserCardValuation = userprofile.v1.IUserCardValuation;
type Credit = cardverdict.v1.ICredit;
type OtherBenefit = cardverdict.v1.IOtherBenefit;
type CreditCard = cardverdict.v1.ICreditCard;
type CustomAdjustment = userprofile.v1.ICustomAdjustment;
type LastEdited = 'dollars' | 'proportion' | undefined;

type CardEditProps = {
    open: boolean;
    card: CreditCard;
    displayCredits?: Credit[];
    displayBenefits?: OtherBenefit[];
    initialValuation?: UserCardValuation;
    onCustomValuationClear?: () => void;
    onClose: () => void;
    onSave?: (valuation: UserCardValuation) => void;
    singleCreditIdToEdit?: string;
    singleBenefitIdToEdit?: string;
    singleCustomAdjustmentIdToEdit?: string;
};

// Form data structure for React Hook Form, exported for children
export type FormValues = {
    credits: Array<{
        creditId: string;
        dollarsInput: string;
        proportionInput: string;
        explanation: string;
        lastEdited: LastEdited;
    }>;
    benefits: Array<{ // New
        benefitId: string;
        dollarsInput: string;
        proportionInput: string;
        explanation: string;
        lastEdited: LastEdited;
    }>;
    customAdjustments: CustomAdjustment[];
};

const emptyValuation = (): UserCardValuation => ({
    creditValuations: {},
    otherBenefitValuations: {},
    customAdjustments: [],
});

const ValuationEditComponent: React.FC<CardEditProps> = (props) => {
    const {
        open, card, displayCredits, displayBenefits, initialValuation, onCustomValuationClear,
        onClose, onSave, singleCreditIdToEdit, singleBenefitIdToEdit, singleCustomAdjustmentIdToEdit,
    } = props;

    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    // 二次确认对话框
    const [confirmClearOpen, setConfirmClearOpen] = useState(false);

    const methods = useForm<FormValues>({
        mode: 'onChange',
    });
    const {handleSubmit, reset, formState: {errors, isDirty}} = methods;

    // Determine which credits/benefits to show in the dialog session
    const sessionCredits = useMemo(() => {
        const allCredits = (displayCredits && displayCredits.length ? displayCredits : card.credits ?? []);
        if (singleCreditIdToEdit) return allCredits.filter(c => c.creditId === singleCreditIdToEdit);
        if (singleBenefitIdToEdit || singleCustomAdjustmentIdToEdit) return [];
        return allCredits;
    }, [open, card.credits, displayCredits, singleCreditIdToEdit, singleBenefitIdToEdit, singleCustomAdjustmentIdToEdit]);

    const sessionBenefits = useMemo(() => {
        const allBenefits = (displayBenefits && displayBenefits.length ? displayBenefits : card.otherBenefits ?? []).filter(shouldHideBenefit);
        if (singleBenefitIdToEdit) return allBenefits.filter(b => b.benefitId === singleBenefitIdToEdit);
        if (singleCreditIdToEdit || singleCustomAdjustmentIdToEdit) return [];
        return allBenefits;
    }, [open, card.otherBenefits, displayBenefits, singleBenefitIdToEdit, singleCreditIdToEdit, singleCustomAdjustmentIdToEdit]);

    // Pre-calculate face values
    const rawAnnualFaceCentsByCreditId = useMemo(() => {
        const result = new Map<string, number>();
        sessionCredits.forEach(credit => {
            if (credit.creditId) {
                result.set(credit.creditId, calcRawAnnualCents(credit));
            }
        });
        return result;
    }, [sessionCredits]);

    const rawAnnualFaceCentsByBenefitId = useMemo(() => {
        const result = new Map<string, number>();
        sessionBenefits.forEach(benefit => {
            if (benefit.benefitId) {
                result.set(benefit.benefitId, benefit.defaultEffectiveValueCents ?? 0);
            }
        });
        return result;
    }, [sessionBenefits]);


    // Initialize/reset form
    useEffect(() => {
        if (!open) return;

        const val = initialValuation ?? emptyValuation();
        const createPerkDefaults = (perks: any[], idKey: string, valKey: string, faceValueMap: Map<string, number>) => {
            return perks.map(perk => {
                const perkId = perk[idKey]!;
                const userVal = (val as any)[valKey]?.[perkId];
                const faceDollars = (faceValueMap.get(perkId) ?? 0) / 100;

                let dollarsInput = '';
                let proportionInput = '';
                let lastEdited: LastEdited;

                if (userVal?.valueCents != null) {
                    lastEdited = 'dollars';
                    dollarsInput = (userVal.valueCents / 100).toFixed(2);
                    if (faceDollars > 0) proportionInput = (Number(dollarsInput) / faceDollars).toFixed(2);
                } else if (userVal?.proportion != null) {
                    lastEdited = 'proportion';
                    proportionInput = Number(userVal.proportion).toFixed(2);
                    if (faceDollars > 0) dollarsInput = (Number(proportionInput) * faceDollars).toFixed(2);
                }

                return {
                    [idKey]: perkId,
                    dollarsInput,
                    proportionInput,
                    explanation: userVal?.explanation ?? '',
                    lastEdited
                };
            });
        };

        const creditDefaults = createPerkDefaults(sessionCredits, 'creditId', 'creditValuations', rawAnnualFaceCentsByCreditId);
        const benefitDefaults = createPerkDefaults(sessionBenefits, 'benefitId', 'otherBenefitValuations', rawAnnualFaceCentsByBenefitId);

        reset({
            credits: creditDefaults,
            benefits: benefitDefaults,
            customAdjustments: val.customAdjustments ?? [],
        });
    }, [open, initialValuation, sessionCredits, sessionBenefits, rawAnnualFaceCentsByCreditId, rawAnnualFaceCentsByBenefitId, reset]);

    const {fields: creditFields} = useFieldArray({control: methods.control, name: "credits", keyName: "key"});
    const {fields: benefitFields} = useFieldArray({control: methods.control, name: "benefits", keyName: "key"});

    const onSubmit = (data: FormValues) => {
        const output: UserCardValuation = {
            ...(initialValuation ?? emptyValuation()),
            // 确保嵌套的估值对象也被复制，而不仅仅是引用。
            creditValuations: {...(initialValuation?.creditValuations ?? {})},
            otherBenefitValuations: {...(initialValuation?.otherBenefitValuations ?? {})},
            // 直接使用表单中最新的 customAdjustments 数组。
            customAdjustments: data.customAdjustments,
        };

        /**
         * 一个通用的函数，用于将表单中的更改合并到估值映射中。
         * @param perks - 来自 react-hook-form 的 perks 数组 (credits 或 benefits)。
         * @param idKey - 'creditId' 或 'benefitId'。
         * @param valuationMap - 要更新的估值对象 (output.creditValuations 或 output.otherBenefitValuations)。
         */
        const mergePerkValuations = (perks: any[], idKey: string, valuationMap: { [key: string]: PerkValue }) => {
            perks.forEach(row => {
                const perkId = row[idKey];
                if (!perkId) return;

                const hasDollars = row.dollarsInput?.trim() !== '';
                const hasProportion = row.proportionInput?.trim() !== '';
                const hasExplanation = row.explanation?.trim() !== '';
                let saved = false;

                if (row.lastEdited === 'dollars' && hasDollars) {
                    valuationMap[perkId] = {
                        valueCents: Math.round(Number(row.dollarsInput) * 100),
                        explanation: row.explanation
                    };
                    saved = true;
                } else if (row.lastEdited === 'proportion' && hasProportion) {
                    valuationMap[perkId] = {
                        proportion: Number(row.proportionInput),
                        explanation: row.explanation
                    };
                    saved = true;
                }

                if (!saved && hasExplanation) {
                    // 如果只有解释，则创建一个只有解释的条目。
                    valuationMap[perkId] = {explanation: row.explanation};
                } else if (!hasDollars && !hasProportion && !hasExplanation) {
                    // 如果用户清空了该行的所有输入，则从估值中删除此条目。
                    delete valuationMap[perkId];
                }
            });
        };

        // 2. 将表单中的 credit 和 benefit 更改合并到 output 对象中。
        mergePerkValuations(data.credits, 'creditId', output.creditValuations!);
        mergePerkValuations(data.benefits, 'benefitId', output.otherBenefitValuations!);
        console.log(output);
        // 3. 使用包含所有正确数据的、完整的 output 对象来调用 onSave。
        onSave?.(output);
        onClose();
    };

    const handleConfirmClear = () => {
        try {
            const db = loadActiveValuationProfile();
            if (!db || !card.cardId || !db.cardValuations?.[card.cardId]) {
                return;
            }
            const cardValuation = db.cardValuations[card.cardId];
            cardValuation.creditValuations = {};
            cardValuation.otherBenefitValuations = {};
            cardValuation.customAdjustments = [];
            saveValuationProfile(db);
        } catch (e) {
            console.error('Failed to clear card valuation:', e);
        } finally {
            setConfirmClearOpen(false);
            onCustomValuationClear?.();
            onClose();
        }
    };

    const sessionTitle = useMemo(() => {
        if (singleCreditIdToEdit) return `编辑报销估值 — ${card.name}`;
        if (singleBenefitIdToEdit) return `编辑福利估值 — ${card.name}`;
        if (singleCustomAdjustmentIdToEdit) return `编辑自定义调整 — ${card.name}`;
        return `编辑估值 — ${card.name}`;
    }, [card.name, singleCreditIdToEdit, singleBenefitIdToEdit, singleCustomAdjustmentIdToEdit]);

    const hasAnyError = Object.keys(errors).length > 0;

    return (
        <FormProvider {...methods}>
            <Dialog fullScreen={isMobile} open={open} onClose={onClose} maxWidth="md" fullWidth>
                <form onSubmit={handleSubmit(onSubmit)}>
                    <DialogTitle>{sessionTitle}</DialogTitle>
                    <DialogContent dividers>
                        {creditFields.length > 0 && (
                            <Stack spacing={2}>
                                {creditFields.map((field, index) => (
                                    <CreditRow
                                        key={field.key}
                                        credit={sessionCredits[index]}
                                        index={index}
                                        faceDollars={(rawAnnualFaceCentsByCreditId.get(sessionCredits[index].creditId!) ?? 0) / 100}
                                        isLastRow={index === creditFields.length - 1}
                                    />
                                ))}
                            </Stack>
                        )}

                        {creditFields.length > 0 && (benefitFields.length > 0 || !singleCreditIdToEdit) &&
                            <Divider sx={{my: 2}}/>}

                        {benefitFields.length > 0 && (
                            <Stack spacing={2}>
                                {benefitFields.map((field, index) => (
                                    <BenefitRow
                                        key={field.key}
                                        benefit={sessionBenefits[index]}
                                        index={index}
                                        faceDollars={(rawAnnualFaceCentsByBenefitId.get(sessionBenefits[index].benefitId!) ?? 0) / 100}
                                        isLastRow={index === benefitFields.length - 1}
                                    />
                                ))}
                            </Stack>
                        )}

                        {benefitFields.length > 0 && !singleBenefitIdToEdit && !singleCreditIdToEdit &&
                            <Divider sx={{my: 2}}/>}

                        {!singleCreditIdToEdit && !singleBenefitIdToEdit &&
                            <CustomAdjustmentsEditor sessionSingleCustomAdjustmentId={singleCustomAdjustmentIdToEdit}/>}
                    </DialogContent>
                    <DialogActions sx={{
                        // 粘底并覆盖整行
                        position: {xs: 'sticky'},
                        bottom: 0,
                        zIndex: 1,
                        bgcolor: 'background.paper',
                        borderTop: (theme) => `1px solid ${theme.palette.divider}`,
                        // 留出安全区内边距，提升全面屏手势区的可点性
                        pb: {xs: 'max(env(safe-area-inset-bottom), 8px)', sm: 2},
                        pt: 1,
                    }}>
                        <Button color="error" variant="text" onClick={() => setConfirmClearOpen(true)}>清空</Button>
                        <Box sx={{flexGrow: 1}}/>
                        <Typography variant="caption" color={hasAnyError ? 'error' : 'text.secondary'}
                                    sx={{ml: 'auto'}}>
                            {hasAnyError ? '存在无效输入，请修正后再保存' : ' '}
                        </Typography>
                        <Button onClick={onClose}>取消</Button>
                        <Button type="submit" variant="contained" disabled={hasAnyError || !isDirty}>保存</Button>
                    </DialogActions>
                </form>
            </Dialog>

            <Dialog open={confirmClearOpen} onClose={() => setConfirmClearOpen(false)} maxWidth="xs">
                <DialogTitle>确认清空？</DialogTitle>
                <DialogContent>
                    <Typography>这将清除“{card.name}”的所有自定义估值，但不清空消费设置，此操作不可撤销。</Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setConfirmClearOpen(false)}>取消</Button>
                    <Button color="error" variant="contained" onClick={handleConfirmClear}>确认清空</Button>
                </DialogActions>
            </Dialog>
        </FormProvider>
    );
};

export default ValuationEditComponent;
