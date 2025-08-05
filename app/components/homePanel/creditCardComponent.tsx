import React from 'react';
import {Card, CardContent, Typography, Grid, CardMedia, Chip, Tooltip} from '@mui/material';
import {cardverdict} from "~/generated/bundle";
import CreditType = cardverdict.v1.CreditType;
import CreditFrequency = cardverdict.v1.CreditFrequency;

// A mapping of brand names to their hex color codes.
const brandColors: { [key: string]: string } = {
    "American Airlines": "#36495A",
    "Agoda": "#FF2938",
    "AMEX": "#016FD0",
    "Avis": "#D4002A",
    "Budget": "#D4002A",
    "Blacklane": "#000000",
    "Capital One Travel": "#D22E1E",
    "Delta": "#003366",
    "Delta Sky Club": "#003366",
    "Expedia": "#1E243A",
    "JSX": "#c82e2c",
    "Lyft": "#FF00BF",
    "Priority Pass Select": "#827127",
    "Resy": "#ff462d",
    "StubHub": "#5224ae",
    "Uber": "#000000",
    "UberEats": "#06C167",
    "United Airlines": "#0033A0",
    "viagogo": "#6fb229",
    "Hilton": "#1E4380",
    "IHG": "#000000",
    "Marriott Bonvoy": "#ee8a64",
    "Renowned Hotels and Resorts": "#0033A0",
    "St. Regis": "#ee8a64",
    "The Ritz-Carlton": "#ee8a64",
    "DashPass": "#EB1700",
    "Dunkin'": "#EF6A00",
    "Five Guys": "#D21033",
    "Grubhub": "#FF8000",
    "Instacart": "#003D29",
    "Apple": "#000000",
    "Bank of America": "#E31837",
    "Best Buy": "#FFF200",
    "Chase": "#005EB8",
    "Citi": "#255BE3",
    "City National Bank (CNB)": "#4374b9",
    "Costco": "#E32A36",
    "DoorDash": "#EB1700",
    "Equinox": "#000000",
    "HSBC": "#EE3524",
    "JPMorgan": "#000000",
    "Peloton": "#000000",
    "Saks Fifth Avenue": "#000000",
    "U.S. Bank": "#CF2A36",
    "Walmart+": "#0071ce",
    // New additions
    "TSA Pre": "#24487b",
    "CLEAR": "#041a55",
};

/**
 * Determines the best contrast text color (black or white) for a given background color.
 * Uses the WCAG relative luminance calculation to determine contrast.
 *
 * @param backgroundColor - The background color in hex format (e.g., "#FF0000")
 * @returns "#FFFFFF" for white or "#000000" for black
 */
export function getTextColor(backgroundColor: string | null | undefined): string {
    if (!backgroundColor) return "#000000";

    // Remove the hash if present
    const hex = backgroundColor.replace('#', '');

    // Convert hex to RGB
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;

    // Calculate relative luminance using WCAG formula
    const luminance = 0.2126 * toSRGB(r) + 0.7152 * toSRGB(g) + 0.0722 * toSRGB(b);

    // Use white text if background is dark (luminance < 0.5)
    return luminance < 0.5 ? "#FFFFFF" : "#000000";
}

/**
 * Helper function to convert RGB values to sRGB for luminance calculation
 */
function toSRGB(value: number): number {
    return value <= 0.03928
        ? value / 12.92
        : Math.pow((value + 0.055) / 1.055, 2.4);
}

// For better type-safety, we can define a type for the available brands.
export type BrandName = keyof typeof brandColors;

/**
 * Retrieves the hex color code for a given brand name.
 * The search is case-insensitive.
 *
 * @param brandName - The name of the brand to look up.
 * @returns The hex color code as a string if found, otherwise undefined.
 */
export function getBrandColor(brandName: string|null|undefined): string | undefined {
    console.log(brandName);
    if(!brandName) return 'blue';

    const lowerCaseBrandName = brandName.toLowerCase();

    // Find the matching key in our brandColors object regardless of case
    const foundKey = Object.keys(brandColors).find(
        (key) => key.toLowerCase() === lowerCaseBrandName
    );

    return foundKey ? brandColors[foundKey] : undefined;
}


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
                <Typography variant="h6" component="div"
                            sx={{fontWeight: 'bold', display: {xs: 'none', md: 'initial'}}}>
                    {card.name}
                </Typography>
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
                            alignItems: {xs: 'center', md: 'initial',},
                            paddingRight: {md: '6em'},
                        }}
                    >
                        <Typography variant="h6" component="div" sx={{fontWeight: 'bold', display: {md: 'none'}}}>
                            {card.name}
                        </Typography>

                        <Grid container direction="column" alignItems="center" sx={{maxWidth: '250px'}}>
                            <CardMedia
                                component="img"
                                image="images/generic.png"
                                alt={`${card.name} card image`}
                                sx={{
                                    mt: 1,
                                    mb: 1,
                                    width: '100%',
                                }}
                            />
                            {card.annualFeeCents != null && (
                                <Typography variant="body2">
                                    Annual Fee: ${(card.annualFeeCents / 100).toFixed(0)}
                                </Typography>
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
                                                        sx={{
                                                            maxWidth: '100%',
                                                            minWidth: '5em',
                                                            bgcolor: getBrandColor(credit.primaryAssociatedBrand),
                                                            color: 'white',
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