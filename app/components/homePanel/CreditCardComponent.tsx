import React, {useEffect, useMemo, useState} from 'react';
import {Box, Card, CardContent, Chip, Divider, Grid, CardMedia, Stack, Tooltip, Typography, IconButton} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import {cardverdict, uservaluation} from "~/generated/bundle";
import CardEditComponent from './CardEditComponent';
import {loadUserValuationDatabase, saveUserValuationDatabase} from '~/client/UserSettingsPersistence';
import CreditFrequency = cardverdict.v1.CreditFrequency;

const genericImageName = 'generic_credit_card_picryl_66dea8.png';

type CreditValueOptions = { useEffectiveValue: boolean };

type CreditCardComponentProps = {
    card: cardverdict.v1.ICreditCard;
    onSaveValuation?: (valuation: uservaluation.v1.IUserCardValuation, card: cardverdict.v1.ICreditCard) => void;
    initialValuation?: uservaluation.v1.IUserCardValuation;
};

const PERIODS_PER_YEAR: Record<CreditFrequency, number> = {
    [CreditFrequency.FREQUENCY_UNSPECIFIED]: 0,
    [CreditFrequency.ANNUAL]: 1,
    [CreditFrequency.SEMI_ANNUAL]: 2,
    [CreditFrequency.QUARTERLY]: 4,
    [CreditFrequency.MONTHLY]: 12,
};

const periodsInYearFor = (frequency?: CreditFrequency): number =>
    frequency == null ? 0 : PERIODS_PER_YEAR[frequency] ?? 0;

const calcRawAnnualCents = (credit: cardverdict.v1.ICredit): number => {
    const {frequency, defaultPeriodValueCents = 0, overrides = []} = credit;
    const periods = periodsInYearFor(frequency ?? undefined);
    if (!periods) return 0;

    if (!overrides?.length) return defaultPeriodValueCents * periods;

    const map = new Map<number, number>();
    for (const ov of overrides) {
        if (ov.period != null && ov.valueCents != null) map.set(ov.period, ov.valueCents);
    }
    let total = 0;
    for (let p = 1; p <= periods; p++) total += map.get(p) ?? defaultPeriodValueCents;
    return total;
};

const defaultEffectiveCents = (credit: cardverdict.v1.ICredit): number => {
    if (credit.defaultEffectiveValueCents != null) return credit.defaultEffectiveValueCents;
    if (credit.defaultEffectiveValueProportion != null) {
        return Math.round(calcRawAnnualCents(credit) * credit.defaultEffectiveValueProportion);
    }
    return 0;
};

const getDisplayEffectiveCents = (
    credit: cardverdict.v1.ICredit,
    userVal?: uservaluation.v1.IUserCardValuation,
): number => {
    const creditId = credit.creditId ?? '';
    const entry = userVal?.creditValuations?.[creditId];
    if (entry?.cents != null) return entry.cents; // 用户以美元（分）覆盖
    if (entry?.proportion != null) {
        return Math.round(calcRawAnnualCents(credit) * entry.proportion); // 用户以比例覆盖
    }
    return defaultEffectiveCents(credit); // 回退默认有效值
};


const getCreditChipColor = (
    credit: cardverdict.v1.ICredit,
    userVal?: uservaluation.v1.IUserCardValuation,
): 'success' | 'warning' | 'error' | 'primary' => {
    const effective = getDisplayEffectiveCents(credit, userVal);
    if (effective === 0) return 'error';

    const raw = calcRawAnnualCents(credit);
    if (raw === 0) {
        return effective > 0 ? 'success' : 'error';
    }

    const proportion = effective / raw;
    if (proportion >= 0.8) return 'success';
    if (proportion >= 0.2) return 'warning';
    return 'error';
};

const colorRank = (credit: cardverdict.v1.ICredit, userVal?: uservaluation.v1.IUserCardValuation): number => {
    const color = getCreditChipColor(credit, userVal);
    return color === 'success' ? 3 : color === 'warning' ? 2 : color === 'error' ? 1 : 0;
};

const CreditCardComponent: React.FC<CreditCardComponentProps> = ({card, onSaveValuation, initialValuation}) => {
    const [editOpen, setEditOpen] = useState(false);
    const [editingCreditId, setEditingCreditId] = useState<string | null>(null);

    // This is the key state. It will be initialized from props, then updated from localStorage.
    const [userValuation, setUserValuation] = useState<uservaluation.v1.IUserCardValuation | undefined>(initialValuation);

    // Effect for loading valuation from localStorage on component mount
    useEffect(() => {
        // We only try to load from local storage if no initial valuation was provided via props.
        if (!initialValuation) {
            const db = loadUserValuationDatabase();
            if (db && card.cardId) {
                const cardValuation = db.cardValuations?.[card.cardId];
                if (cardValuation) {
                    setUserValuation(cardValuation);
                }
            }
        }
    }, [card.cardId, initialValuation]);

    // 使用“用户优先”的有效值计算汇总
    const totalCreditsValue = useMemo(() => {
        const credits = card.credits ?? [];
        return credits.reduce((sum, c) => sum + getDisplayEffectiveCents(c, userValuation), 0);
    }, [card.credits, userValuation]);

    const annualFee = card.annualFeeCents || 0;
    const roi = totalCreditsValue - annualFee;

    // 卡片UI展示顺序（使用用户估值后的颜色/数值排序，确保与编辑对话框一致）
    const sortedCredits = useMemo(() => {
        const credits = card.credits ?? [];
        return [...credits].sort((a, b) => {
            const rankDiff = colorRank(b, userValuation) - colorRank(a, userValuation);
            if (rankDiff !== 0) return rankDiff;
            const aVal = getDisplayEffectiveCents(a, userValuation);
            const bVal = getDisplayEffectiveCents(b, userValuation);
            return bVal - aVal; // higher value first
        });
    }, [card.credits, userValuation]);

    // 如果列表里任意一个 credit 的整数金额（四舍五入到美元）为4位数及以上，则所有 Chip 用 5em，否则 4em
    const hasAnyFourPlusDigits = useMemo(() => {
        const credits = card.credits ?? [];
        for (const c of credits) {
            const cents = getDisplayEffectiveCents(c, userValuation);
            const dollarsRounded = Math.round(cents / 100);
            const digits = Math.abs(dollarsRounded).toString().length; // 负值也能正确计算位数
            if (digits >= 4) return true; // 提前返回，提升性能
        }
        return false;
    }, [card.credits, userValuation]);

    const handleSaveValuation = (valuation: uservaluation.v1.IUserCardValuation) => {
        if (!card.cardId) {
            console.error("Cannot save valuation for a card without a cardId.");
            return;
        }

        // 1. Update local component state to immediately reflect changes in the UI.
        setUserValuation(valuation);

        // 2. Load the entire database, or create a new one.
        const db = loadUserValuationDatabase() ?? { cardValuations: {}, pointSystemValuations: {} };

        // 3. Update the valuation for the current card.
        if (!db.cardValuations) {
            db.cardValuations = {};
        }
        db.cardValuations[card.cardId] = valuation;

        // 4. Save the updated database back to localStorage.
        saveUserValuationDatabase(db);

        // 5. Notify any parent component about the save.
        onSaveValuation?.(valuation, card);
    };


    return (
        <Card sx={{height: '100%', display: 'flex', flexDirection: 'column', boxShadow: 2, borderRadius: 4, position: 'relative'}}>
            <CardContent sx={{flexGrow: 1, display: 'flex', flexDirection: 'column'}}>
                <Box sx={{position: 'absolute', top: 8, right: 8, zIndex: 1}}>
                    <Tooltip title="编辑">
                        <IconButton
                            aria-label="edit card"
                            size="small"
                            color="primary"
                            onClick={() => setEditOpen(true)}
                        >
                            <EditIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                </Box>

                <Grid container spacing={2} alignItems="center" flexWrap="nowrap">
                    <Grid size={4} flexShrink={0}>
                        <CardMedia
                            component="img"
                            image={`images/${card.imageName || genericImageName}`}
                            alt={`${card.name} card image`}
                            sx={{
                                width: 125,
                                objectFit: 'fill',
                                aspectRatio: '1.586/1',
                                borderRadius: '4px',
                                boxShadow: 3,
                            }}
                        />
                    </Grid>
                    <Grid>
                        <Typography variant="subtitle1" component="div"
                                    sx={{fontWeight: 'bold', wordBreak: 'break-word'}}>
                            {card.name}
                        </Typography>
                    </Grid>
                </Grid>

                <Grid container spacing={2} sx={{my: 2, textAlign: 'center'}}>
                    <Grid size={{xs: 6}}>
                        <Typography variant="body2" color="text.secondary">
                            年费
                        </Typography>
                        <Typography variant="h6" sx={{fontWeight: 'bold'}}>
                            {card.annualFeeCents != null ? `$${(card.annualFeeCents / 100).toFixed(0)}` : 'N/A'}
                        </Typography>
                    </Grid>
                    <Grid size={{xs: 6}}>
                        <Typography variant="body2" color="text.secondary">
                            净值
                        </Typography>
                        <Typography variant="h5"
                                    sx={{fontWeight: 'bold', color: roi >= 0 ? 'success.main' : 'error.main'}}>
                            ${(roi / 100).toFixed(0)}
                        </Typography>
                    </Grid>
                </Grid>

                <Divider sx={{mb: 2}}/>

                <Box sx={{flexGrow: 1, overflowY: 'auto', minHeight: 0}}>
                    <Typography variant="h6" component="div" gutterBottom sx={{ display: 'inline-block', borderBottom: '2px solid', borderColor: 'primary.main' }}>
                        Credits
                    </Typography>

                    {(sortedCredits?.length ?? 0) > 0 ? (
                        <Stack>
                            {sortedCredits.map((credit, index) => {
                                const valueCents = getDisplayEffectiveCents(credit, userValuation);
                                const value = valueCents / 100;
                                const isLast = index === sortedCredits.length - 1;
                                const getTooltipForCredit = (
                                    credit: cardverdict.v1.ICredit,
                                    userVal?: uservaluation.v1.IUserCardValuation,
                                ): string | undefined => {
                                    const creditId = credit.creditId ?? '';
                                    const creditValuation = userVal?.creditValuations?.[creditId];
                                    const userNote = userVal?.creditValuations?.[creditId]?.explanation?.trim();
                                    if(userNote && userNote.length > 0) return userNote;

                                    if(creditValuation?.cents || creditValuation?.proportion) return '自定义估值（未输入原因）';

                                    return credit.defaultEffectiveValueExplanation ?? '';
                                };


                                return (
                                    <Box key={credit.creditId ?? index}>
                                        <Grid alignItems="baseline" justifyContent="space-between" display="flex" gap={1}>
                                            <Grid flexGrow={1} size={{xs: 10}}>
                                                <Typography variant="body2" sx={{wordBreak: 'break-word'}}>
                                                    {credit.details}
                                                </Typography>
                                            </Grid>
                                            <Grid flexShrink={0} flexGrow={1}>
                                                <Tooltip title={getTooltipForCredit(credit, userValuation)}>
                                                    <Chip
                                                        label={`$${value.toFixed(0)}`}
                                                        size="small"
                                                        color={getCreditChipColor(credit, userValuation)}
                                                        sx={{ width: hasAnyFourPlusDigits ? '5em' : '4em', textAlign: 'center', cursor: 'pointer' }}
                                                        onClick={() => setEditingCreditId(credit.creditId ?? null)}
                                                    />
                                                </Tooltip>

                                            </Grid>
                                        </Grid>

                                        {!isLast && <Divider sx={{mb: 1, mt: 1}}/>}
                                    </Box>
                                );
                            })}
                        </Stack>
                    ) : (
                        <Typography variant="body2">No credits available.</Typography>
                    )}
                </Box>
            </CardContent>

            {/* 把最新的用户估值作为 initialValuation 回传，保证二次打开能回显 */}
            <CardEditComponent
                open={editOpen}
                card={card}
                displayCredits={sortedCredits}
                initialValuation={userValuation}
                onClose={() => setEditOpen(false)}
                onSave={handleSaveValuation}
            />
            {/* 单个 credit 编辑对话框 */}
            <CardEditComponent
                open={!!editingCreditId}
                card={card}
                displayCredits={sortedCredits}
                initialValuation={userValuation}
                onClose={() => setEditingCreditId(null)}
                onSave={handleSaveValuation}
                singleCreditIdToEdit={editingCreditId ?? undefined}
            />
        </Card>
    );
};

export default CreditCardComponent;
