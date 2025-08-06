import React from 'react';
import {Card, CardContent, Typography, Grid, CardMedia, Chip, Tooltip} from '@mui/material';
import {cardverdict} from "~/generated/bundle";
import CreditType = cardverdict.v1.CreditType;
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
        <Card>
            <CardContent>
                <Grid
                    container
                    spacing={2}
                    sx={{
                        flexWrap: {xs: 'wrap', md: 'nowrap'},
                    }}
                >
                    {/* Region 1: Image, Fee */}
                    <Grid
                        item
                        xs={12}
                        md={4}
                        sx={{
                            display: 'flex',
                            flexGrow: 1,
                            flexBasis: {md: '33.33%'},
                            flexDirection: 'column',
                            alignItems: {xs: 'center', md: 'center',},
                            paddingRight: {md: '6em'},
                        }}
                    >
                        <Typography variant="h6" component="div" sx={{fontWeight: 'bold', textAlign: 'center'}}>
                            {card.name}
                        </Typography>

                        <Grid container direction="column" alignItems="center" sx={{maxWidth: '250px'}}>
                            <CardMedia
                                component="img"
                                image={`images/${card.imageName || genericImageName}`}
                                alt={`${card.name} card image`}
                                sx={{
                                    mt: 1,
                                    mb: 1,
                                    width: '100%',
                                }}
                            />
                            {card.annualFeeCents != null && (
                                <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                                    <Chip label={`$${(card.annualFeeCents / 100).toFixed(0)}`} size="small"
                                          color="primary"/>
                                    <Typography variant="body2">年费</Typography>
                                </div>
                            )}
                        </Grid>
                    </Grid>

                    {/* Region 2: Credits */}
                    <Grid
                        item
                        xs={12}
                        md={4}
                        sx={{flexGrow: 1, flexBasis: {md: '33.33%'}}}
                    >
                        <Typography variant="h6" component="div" gutterBottom>
                            Credits
                        </Typography>
                        {card.credits && card.credits.length > 0 ? (
                            <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
                                {card.credits.map((credit, index) => {
                                    const creditValue = calculateAnnualCreditValue(credit, {useEffectiveValue: true}) / 100;
                                    return (
                                        <div
                                            key={index}
                                            style={{
                                                display: 'grid',
                                                gridTemplateColumns: 'minmax(3em, auto) minmax(0, 1fr)',
                                                gap: '1rem',
                                                alignItems: 'first baseline' // Using first baseline for natural text alignment
                                            }}
                                        >
                                            <div style={{
                                                display: 'flex',
                                                alignItems: 'first baseline'
                                            }}>
                                                <Tooltip title={credit.effectiveValueExplanation}>
                                                    <Chip
                                                        label={`$${creditValue.toFixed(0)}`}
                                                        size="small"
                                                        color={getCreditChipColor(credit)}
                                                        sx={{
                                                            maxWidth: '100%',
                                                            minWidth: '5em',
                                                            '& .MuiChip-label': {
                                                                display: 'block',
                                                                overflow: 'hidden',
                                                                textOverflow: 'ellipsis'
                                                            }
                                                        }}
                                                    />
                                                </Tooltip>
                                            </div>
                                            <Typography
                                                variant="body2"
                                                sx={{
                                                    minWidth: 0,
                                                    wordBreak: 'break-word',
                                                    overflowWrap: 'break-word'
                                                }}
                                            >
                                                {credit.details}
                                            </Typography>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <Typography variant="body2">No credits available.</Typography>
                        )}
                    </Grid>

                    {/* Region 3: Net Value  */}
                    <Grid
                        item
                        xs={12}
                        md={4}
                        sx={{flexGrow: 1, flexBasis: {md: '33.33%'}}}
                    >
                        <Typography variant="h6" component="div" gutterBottom>
                            Net Value
                        </Typography>
                        <Typography variant="h5" component="div"
                                    sx={{color: roi >= 0 ? 'success.main' : 'error.main', fontWeight: 'bold'}}>
                            ${(roi / 100).toFixed(0)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{mt: 1}}>
                            Based on credits:
                        </Typography>
                        <Typography variant="body2" sx={{mt: 0.5}}>
                            ${(totalCreditsValue / 100).toFixed(0)} in credits
                        </Typography>
                        <Typography variant="body2">
                            - ${(annualFee / 100).toFixed(0)} annual fee
                        </Typography>
                    </Grid>
                </Grid>
            </CardContent>
        </Card>
    );
};

const renderOtherBenefit = (benefit: cardverdict.v1.IOtherBenefit, index: number) => {
    let description = '';
    if (benefit.loungeAccess) {
        const {network, guestPolicy} = benefit.loungeAccess;
        description = `Lounge Access: ${network} (Guest Policy: ${guestPolicy})`;
    } else if (benefit.travelStatus) {
        description = `Travel Status: ${benefit.travelStatus.description}`;
    } else if (benefit.feeReimbursement) {
        description = `Fee Reimbursement: ${benefit.feeReimbursement.programs?.join(', ')}`;
    } else if (benefit.baggage) {
        description = `Baggage: ${benefit.baggage.freeCheckedBagsCount} free checked bag(s)`;
    } else if (benefit.pointPerk) {
        description = `Point Perk: ${benefit.pointPerk.description}`;
    } else if (benefit.genericBenefitDescription) {
        description = benefit.genericBenefitDescription;
    }

    return (
        <Typography key={index} variant="body2" component="div" sx={{mt: 1}}>
            • {description}
        </Typography>
    );
};

export default CreditCardComponent;
