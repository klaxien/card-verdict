import React, {useMemo} from 'react';
import {Box, Card, CardContent, Chip, Divider, Grid, CardMedia, Stack, Tooltip, Typography} from '@mui/material';
import {cardverdict} from "~/generated/bundle";
import CreditFrequency = cardverdict.v1.CreditFrequency;

const genericImageName = 'generic_credit_card_picryl_66dea8.png';

type CreditValueOptions = { useEffectiveValue: boolean };

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

const CreditCardComponent: React.FC<{ card: cardverdict.v1.ICreditCard }> = ({card}) => {
    const totalCreditsValue = useMemo(
        () => calculateTotalAnnualCredits(card, {useEffectiveValue: true}),
        [card],
    );

    const annualFee = card.annualFeeCents || 0;
    const roi = totalCreditsValue - annualFee;

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
        <Card sx={{height: '100%', display: 'flex', flexDirection: 'column', boxShadow: 2, borderRadius: 4}}>
            <CardContent sx={{flexGrow: 1, display: 'flex', flexDirection: 'column'}}>
                {/* Section 1: Image & Name */}
                <Grid container spacing={2} alignItems="center" flexWrap="nowrap">
                    <Grid size={4} flexShrink={0}>
                        <CardMedia
                            component="img"
                            image={`images/${card.imageName || genericImageName}`}
                            alt={`${card.name} card image`}
                            sx={{
                                width: 125,
                                objectFit: 'fill',
                                aspectRatio: '1.586/1', // Standard credit card aspect ratio
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

                {/* Section 2: Fees */}
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

                {/* Section 3: Credits */}
                <Box sx={{flexGrow: 1, overflowY: 'auto', minHeight: 0}}>
                    <Typography variant="h6" component="div" gutterBottom   sx={{ display: 'inline-block', borderBottom: '2px solid', borderColor: 'primary.main' }}>
                        Credits
                    </Typography>

                    {sortedCredits.length > 0 ? (
                        <Stack>
                            {sortedCredits.map((credit, index) => {
                                const creditValueCents = calculateAnnualCreditValue(credit, {useEffectiveValue: true});
                                const creditValue = creditValueCents / 100;
                                const chipColor = getCreditChipColor(credit);
                                const isLast = index === sortedCredits.length - 1;

                                return (
                                    <Box key={index}>
                                        <Grid alignItems="baseline" justifyContent="space-between" display="flex"
                                              gap={1}>
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
                                                        color={chipColor}
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
        </Card>
    );
};

export default CreditCardComponent;