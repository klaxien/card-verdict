import React, {useMemo, useState} from 'react';
import {Box, Card, CardContent, Chip, Divider, Grid, CardMedia, Stack, Tooltip, Typography, IconButton} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import {cardverdict, uservaluation} from "~/generated/bundle";
import CardEditComponent from './CardEditComponent';
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

const calculateAnnualCreditValue = (
    credit: cardverdict.v1.ICredit,
    options?: CreditValueOptions,
): number => {
    const calcRawAnnual = (): number => {
        const {frequency, defaultPeriodValueCents, overrides = []} = credit;
        const periodsInYear = periodsInYearFor(frequency ?? undefined);
        if (!periodsInYear) return 0;

        const baseValue = defaultPeriodValueCents ?? 0;

        if (!overrides?.length) {
            return baseValue * periodsInYear;
        }

        const overrideMap = new Map<number, number>();
        for (const ov of overrides) {
            if (ov.period != null && ov.valueCents != null) {
                overrideMap.set(ov.period, ov.valueCents);
            }
        }

        let total = 0;
        for (let period = 1; period <= periodsInYear; period++) {
            total += overrideMap.get(period) ?? baseValue;
        }
        return total;
    };

    if (options?.useEffectiveValue) {
        if (credit.defaultEffectiveValueCents != null) return credit.defaultEffectiveValueCents;
        if (credit.defaultEffectiveValueProportion != null) {
            return calcRawAnnual() * credit.defaultEffectiveValueProportion;
        }
        return 0;
    }

    return calcRawAnnual();
};

const calculateTotalAnnualCredits = (
    card: cardverdict.v1.ICreditCard,
    options?: CreditValueOptions,
): number => {
    const credits = card.credits ?? [];
    if (!credits.length) return 0;
    return credits
        .map(c => calculateAnnualCreditValue(c, options))
        .reduce((sum, v) => sum + v, 0);
};

const getCreditChipColor = (
    credit: cardverdict.v1.ICredit,
): 'success' | 'warning' | 'error' | 'primary' => {
    const effective = calculateAnnualCreditValue(credit, {useEffectiveValue: true});
    if (effective === 0) return 'error';

    const raw = calculateAnnualCreditValue(credit, {useEffectiveValue: false});
    if (raw === 0) {
        return effective > 0 ? 'success' : 'error';
    }

    const proportion = effective / raw;
    if (proportion > 0.8) return 'success';
    if (proportion >= 0.2) return 'warning';
    return 'error';
};

const colorRank = (credit: cardverdict.v1.ICredit): number => {
    const color = getCreditChipColor(credit);
    // success > warning > error > primary
    return color === 'success' ? 3 : color === 'warning' ? 2 : color === 'error' ? 1 : 0;
};

const CreditCardComponent: React.FC<CreditCardComponentProps> = ({card, onSaveValuation, initialValuation}) => {
    const [editOpen, setEditOpen] = useState(false);

    const totalCreditsValue = useMemo(
        () => calculateTotalAnnualCredits(card, {useEffectiveValue: true}),
        [card],
    );

    const annualFee = card.annualFeeCents || 0;
    const roi = totalCreditsValue - annualFee;

    // 卡片UI展示顺序（用于编辑对话框保持一致）
    const sortedCredits = useMemo(() => {
        const credits = card.credits ?? [];
        return [...credits].sort((a, b) => {
            const rankDiff = colorRank(b) - colorRank(a);
            if (rankDiff !== 0) return rankDiff;

            const aVal = calculateAnnualCreditValue(a, {useEffectiveValue: true});
            const bVal = calculateAnnualCreditValue(b, {useEffectiveValue: true});
            return bVal - aVal; // higher value first
        });
    }, [card.credits]);

    return (
        <Card sx={{height: '100%', display: 'flex', flexDirection: 'column', boxShadow: 2, borderRadius: 4, position: 'relative'}}>
            <CardContent sx={{flexGrow: 1, display: 'flex', flexDirection: 'column'}}>
                {/* 顶部右侧仅保留一个“编辑”按钮 */}
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

                {/* 卡片头部 */}
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

                {/* 费用与净值 */}
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

                {/* Credits 列表 */}
                <Box sx={{flexGrow: 1, overflowY: 'auto', minHeight: 0}}>
                    <Typography variant="h6" component="div" gutterBottom sx={{ display: 'inline-block', borderBottom: '2px solid', borderColor: 'primary.main' }}>
                        Credits
                    </Typography>

                    {sortedCredits.length > 0 ? (
                        <Stack>
                            {sortedCredits.map((credit, index) => {
                                const creditValueCents = calculateAnnualCreditValue(credit, {useEffectiveValue: true});
                                const creditValue = creditValueCents / 100;
                                const isLast = index === sortedCredits.length - 1;

                                return (
                                    <Box key={credit.creditId ?? index}>
                                        <Grid alignItems="baseline" justifyContent="space-between" display="flex" gap={1}>
                                            <Grid flexGrow={1} size={{xs: 10}}>
                                                <Typography variant="body2" sx={{wordBreak: 'break-word'}}>
                                                    {credit.details}
                                                </Typography>
                                            </Grid>
                                            <Grid flexShrink={0} flexGrow={1}>
                                                <Tooltip title={credit.defaultEffectiveValueExplanation}>
                                                    <Chip
                                                        label={`$${creditValue.toFixed(0)}`}
                                                        size="small"
                                                        color={getCreditChipColor(credit)}
                                                        sx={{width: '4em', textAlign: 'center'}}
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

            {/* 打开单一“巨型表单”对话框，按 UI 顺序编辑所有 credits */}
            <CardEditComponent
                open={editOpen}
                card={card}
                displayCredits={sortedCredits}
                initialValuation={initialValuation}
                onClose={() => setEditOpen(false)}
                onSave={(v) => onSaveValuation?.(v, card)}
            />
        </Card>
    );
};

export default CreditCardComponent;
