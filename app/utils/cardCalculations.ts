import {cardverdict, userprofile} from '~/generated/bundle';
import CreditFrequency = cardverdict.v1.CreditFrequency;

export const PERIODS_PER_YEAR: Record<CreditFrequency, number> = {
    [CreditFrequency.FREQUENCY_UNSPECIFIED]: 0,
    [CreditFrequency.ANNUAL]: 1,
    [CreditFrequency.SEMI_ANNUAL]: 2,
    [CreditFrequency.QUARTERLY]: 4,
    [CreditFrequency.MONTHLY]: 12,
};

export const periodsInYearFor = (frequency?: CreditFrequency | null): number =>
    frequency == null ? 0 : PERIODS_PER_YEAR[frequency] ?? 0;

export const calcRawAnnualCents = (credit: cardverdict.v1.ICredit): number => {
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

export const defaultEffectiveCents = (credit: cardverdict.v1.ICredit): number => {
    if (credit.defaultEffectiveValueCents != null) return credit.defaultEffectiveValueCents;
    if (credit.defaultEffectiveValueProportion != null) {
        return Math.round(calcRawAnnualCents(credit) * credit.defaultEffectiveValueProportion);
    }
    return 0;
};

export const getDisplayEffectiveCents = (
    credit: cardverdict.v1.ICredit,
    userVal?: userprofile.v1.IUserCardValuation,
): number => {
    const creditId = credit.creditId ?? '';
    const entry = userVal?.creditValuations?.[creditId];
    if (entry?.cents != null) return entry.cents;
    if (entry?.proportion != null) {
        return Math.round(calcRawAnnualCents(credit) * entry.proportion);
    }
    return defaultEffectiveCents(credit);
};

export const calculateNetWorth = (
    card: cardverdict.v1.ICreditCard,
    userDb: userprofile.v1.IValuationProfile | null
): number => {
    const cardId = card.cardId ?? '';
    const userValuation = userDb?.cardValuations?.[cardId];

    const totalCreditsValue = (card.credits ?? []).reduce(
        (sum, c) => sum + getDisplayEffectiveCents(c, userValuation),
        0
    );

    const totalCustomAdjustmentsValue = (userValuation?.customAdjustments ?? []).reduce((sum, adj) => {
        const periods = periodsInYearFor(adj.frequency ?? undefined);
        const annualValue = (adj.valueCents ?? 0) * periods;
        return sum + annualValue;
    }, 0);

    const annualFee = card.annualFeeCents || 0;
    return totalCreditsValue + totalCustomAdjustmentsValue - annualFee;
};
