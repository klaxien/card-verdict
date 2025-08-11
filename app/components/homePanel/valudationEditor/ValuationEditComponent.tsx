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
import {CreditRow} from './CreditRow';
import {loadActiveValuationProfile, saveValuationProfile} from '~/client/userSettingsPersistence';

// Type Definitions
type PerkValue = userprofile.v1.IPerkValue;
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

// Form data structure for React Hook Form, exported for children
export type FormValues = {
    credits: Array<{
        creditId: string;
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
        open, card, displayCredits, initialValuation, onCustomValuationClear,
        onClose, onSave, singleCreditIdToEdit, singleCustomAdjustmentIdToEdit,
    } = props;

    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    // 二次确认对话框
    const [confirmClearOpen, setConfirmClearOpen] = useState(false);

    const methods = useForm<FormValues>({
        mode: 'onChange',
    });
    const {handleSubmit, reset, formState: {errors, isDirty}} = methods;

    // 用于渲染的顺序（由父组件传入），对话框会基于该顺序进行“置顶”，但在一次打开会话中不再实时变动
    const sessionCredits = useMemo(() => {
        const allCredits = (displayCredits && displayCredits.length ? displayCredits : card.credits ?? []);
        if (singleCreditIdToEdit) return allCredits.filter(c => c.creditId === singleCreditIdToEdit);
        if (singleCustomAdjustmentIdToEdit) return [];
        return allCredits;
    }, [open, card.credits, displayCredits, singleCreditIdToEdit, singleCustomAdjustmentIdToEdit]);

    // 预先计算每个 credit 的年度面值（分）
    const rawAnnualFaceCentsByCreditId = useMemo(() => {
        const result = new Map<string, number>();
        sessionCredits.forEach(credit => {
            if (credit.creditId) {
                result.set(credit.creditId, calcRawAnnualCents(credit));
            }
        });
        return result;
    }, [sessionCredits]);

    // 初始化/重置表单
    useEffect(() => {
        if (!open) return;

        const val = initialValuation ?? emptyValuation();
        const creditDefaults = sessionCredits.map(credit => {
            const creditId = credit.creditId!;
            const userVal = val.creditValuations?.[creditId];
            const faceDollars = (rawAnnualFaceCentsByCreditId.get(creditId) ?? 0) / 100;

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

            return {creditId, dollarsInput, proportionInput, explanation: userVal?.explanation ?? '', lastEdited};
        });

        reset({
            credits: creditDefaults,
            customAdjustments: val.customAdjustments ?? [],
        });
    }, [open, initialValuation, sessionCredits, rawAnnualFaceCentsByCreditId, reset]);

    const {fields: creditFields} = useFieldArray({control: methods.control, name: "credits", keyName: "key"});

    const onSubmit = (data: FormValues) => {
        const output: UserCardValuation = {
            ...(initialValuation ?? emptyValuation()),
            creditValuations: {},
            customAdjustments: data.customAdjustments,
        };

        data.credits.forEach(row => {
            let saved = false;
            const hasDollars = row.dollarsInput.trim() !== '';
            const hasProportion = row.proportionInput.trim() !== '';

            if (row.lastEdited === 'dollars' && hasDollars) {
                output.creditValuations![row.creditId] = {
                    valueCents: Math.round(Number(row.dollarsInput) * 100),
                    explanation: row.explanation
                };
                saved = true;
            } else if (row.lastEdited === 'proportion' && hasProportion) {
                output.creditValuations![row.creditId] = {
                    proportion: Number(row.proportionInput),
                    explanation: row.explanation
                };
                saved = true;
            }

            if (!saved && row.explanation?.trim()) {
                output.creditValuations![row.creditId] = {explanation: row.explanation};
            }
        });

        onSave?.(output);
        onClose();
    };

    // 新增：清空当前卡片的所有自定义设置（credit + custom），直接从 map 中删除并持久化
    const handleConfirmClear = () => {
        try {
            const db = loadActiveValuationProfile();
            if (!db || !card.cardId || !db.cardValuations?.[card.cardId]) {
                // 如果没有估值，则无需任何操作
                return;
            }

            // 只清空其负责的字段
            const cardValuation = db.cardValuations[card.cardId];
            cardValuation.creditValuations = {};
            cardValuation.otherBenefitValuations = {}; // 也清空 other benefits
            cardValuation.customAdjustments = [];

            // plannedSpending 字段被有意地保留了下来

            saveValuationProfile(db);

        } catch (e) {
            console.error('Failed to clear card valuation:', e);
        } finally {
            setConfirmClearOpen(false);
            onCustomValuationClear?.();
            onClose();
        }
    };

    // 会话内冻结的标题，防止关闭动画期间因 props 变化造成闪动
    const sessionTitle = useMemo(() => {
        if (singleCustomAdjustmentIdToEdit) return `编辑自定义调整 — ${card.name}`;
        return `编辑${singleCreditIdToEdit ? '单项' : ''}报销估值 — ${card.name}`;
    }, [card.name, singleCreditIdToEdit, singleCustomAdjustmentIdToEdit]);

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

                        {creditFields.length > 0 && !singleCreditIdToEdit && <Divider sx={{my: 2}}/>}

                        {!singleCreditIdToEdit &&
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
