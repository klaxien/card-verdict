import React from 'react';
import {Box, Card, CardContent, Chip, Divider, Grid,CardMedia, Stack, Tooltip, Typography} from '@mui/material';
import {cardverdict} from "~/generated/bundle";
import CreditFrequency = cardverdict.v1.CreditFrequency;

const genericImageName = 'generic_credit_card_picryl_66dea8.png';

const getCreditChipColor = (credit: cardverdict.v1.ICredit): "success" | "warning" | "error" | "primary" => {
    const effectiveValue = calculateAnnualCreditValue(credit, {useEffectiveValue: true});

    if (effectiveValue === 0) {
        return 'error';
    }

    const rawValue = calculateAnnualCreditValue(credit, {useEffectiveValue: false});

    if (rawValue === 0) {
        return effectiveValue > 0 ? 'success' : 'error';
    }

    const proportion = effectiveValue / rawValue;

    if (proportion > 0.8) {
        return 'success';
    }
    if (proportion >= 0.2) { // [0.2, 0.8]
        return 'warning';
    }
    return 'error'; // < 0.2
};

const calculateAnnualCreditValue = (credit: cardverdict.v1.ICredit, options?: {
    useEffectiveValue: boolean
}): number => {
    const calculateRawValue = (): number => {
        const {frequency, defaultPeriodValueCents, overrides = []} = credit;

        const periodsInYear = {
            [CreditFrequency.FREQUENCY_UNSPECIFIED]: 0,
            [CreditFrequency.ANNUAL]: 1,
            [CreditFrequency.SEMI_ANNUAL]: 2,
            [CreditFrequency.QUARTERLY]: 4,
            [CreditFrequency.MONTHLY]: 12,
        }[frequency!];

        if (!periodsInYear) {
            return 0;
        }

        const valueCents = defaultPeriodValueCents ?? 0;

        if (!overrides || overrides.length === 0) {
            return valueCents * periodsInYear;
        }

        const overrideMap = new Map<number, number>();
        for (const override of overrides) {
            if (override.period != null && override.valueCents != null) {
                overrideMap.set(override.period, override.valueCents);
            }
        }

        let totalValue = 0;
        for (let i = 1; i <= periodsInYear; i++) {
            totalValue += overrideMap.get(i) || valueCents;
        }

        return totalValue;
    };

    if (options?.useEffectiveValue) {
        if (credit.effectiveValueCents != null) {
            return credit.effectiveValueCents;
        }
        if (credit.effectiveValueProportion != null) {
            return calculateRawValue() * credit.effectiveValueProportion;
        }
        return 0;
    }

    return calculateRawValue();
};

const calculateTotalAnnualCredits = (card: cardverdict.v1.ICreditCard, options?: {
    useEffectiveValue: boolean
}): number => {
    if (!card.credits) {
        return 0;
    }
    return card.credits.map(credit => calculateAnnualCreditValue(credit, options)).reduce((sum, value) => sum + value, 0);
};

const CreditCardComponent: React.FC<{ card: cardverdict.v1.ICreditCard }> = ({card}) => {
    const totalCreditsValue = calculateTotalAnnualCredits(card, {useEffectiveValue: true});
    const annualFee = card.annualFeeCents || 0;
    const roi = totalCreditsValue - annualFee;

    return (
        <Card sx={{height: '100%', display: 'flex', flexDirection: 'column', boxShadow: 2, borderRadius: 4,}}>
            <CardContent sx={{flexGrow: 1, display: 'flex', flexDirection: 'column'}}>
                {/* Section 1: Image & Name */}
                <Grid container spacing={2} alignItems="center" flexWrap="nowrap" >
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
                                boxShadow: 3
                            }}
                        />
                    </Grid>
                    <Grid >
                        <Typography variant="subtitle1" component="div" sx={{fontWeight: 'bold', wordBreak: 'break-word' }}>
                            {card.name}
                        </Typography>
                    </Grid>
                </Grid>

                {/* Section 2: Fees */}
                <Grid container spacing={2} sx={{my: 2, textAlign: 'center'}}>
                    <Grid size={{xs: 6}}>
                        <Typography variant="body2" color="text.secondary">年费</Typography>
                        <Typography variant="h6" sx={{fontWeight: 'bold'}}>
                            {card.annualFeeCents != null ? `$${(card.annualFeeCents / 100).toFixed(0)}` : 'N/A'}
                        </Typography>
                    </Grid>
                    <Grid size={{xs: 6}}>
                        <Typography variant="body2" color="text.secondary">净值</Typography>
                        <Typography variant="h5"
                                    sx={{fontWeight: 'bold', color: roi >= 0 ? 'success.main' : 'error.main'}}>
                            ${(roi / 100).toFixed(0)}
                        </Typography>
                    </Grid>
                </Grid>

                <Divider sx={{mb: 2}}/>

                {/* Section 3: Credits */}
                <Box sx={{flexGrow: 1, overflowY: 'auto', minHeight: 0}}>
                    <Typography variant="h6" component="div" gutterBottom>
                        Credits
                    </Typography>
                    {card.credits && card.credits.length > 0 ? (
                        <Stack spacing={1.5}>
                            {card.credits.map((credit, index) => {
                                const creditValue = calculateAnnualCreditValue(credit, { useEffectiveValue: true }) / 100;
                                const isLast = index === card.credits!.length - 1;

                                return (
                                    <Box key={index}>
                                        <Grid
                                            alignItems="baseline"
                                            justifyContent="space-between"
                                            display="flex"
                                            gap={1}
                                        >
                                            <Grid flexGrow={1} size={{ xs: 10 }}>
                                                <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
                                                    {credit.details}
                                                </Typography>
                                            </Grid>
                                            <Grid flexShrink={0} flexGrow={1}>
                                                <Tooltip title={credit.effectiveValueExplanation}>
                                                    <Chip
                                                        label={`$${creditValue.toFixed(0)}`}
                                                        size="small"
                                                        color={getCreditChipColor(credit)}
                                                        sx={{ width: '4em', textAlign: 'center' }}
                                                    />
                                                </Tooltip>
                                            </Grid>
                                        </Grid>

                                        {!isLast && <Divider sx={{ mb: 1, mt: 1 }} />}
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