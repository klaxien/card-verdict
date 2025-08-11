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

    if (!overrides?.length) return (defaultPeriodValueCents ?? 0) * periods;

    const map = new Map<number, number>();
    for (const ov of overrides) {
        if (ov.period != null && ov.valueCents != null) map.set(ov.period, ov.valueCents);
    }
    let total = 0;
    for (let p = 1; p <= periods; p++) total += map.get(p) ?? defaultPeriodValueCents ?? 0;
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
    if (entry?.valueCents != null) return entry.valueCents;
    if (entry?.proportion != null) {
        return Math.round(calcRawAnnualCents(credit) * entry.proportion);
    }
    return defaultEffectiveCents(credit);
};

/**
 * 计算单个 OtherBenefit 的最终显示价值（考虑用户自定义估值）。
 * @param benefit - 福利对象。
 * @param userVal - 当前用户的卡片估值。
 * @returns 最终价值（以美分为单位）。
 */
export const getDisplayEffectiveCentsForBenefit = (
    benefit: cardverdict.v1.IOtherBenefit,
    userVal?: userprofile.v1.IUserCardValuation,
): number => {
    const benefitId = benefit.benefitId ?? '';
    // 1. 优先检查用户自定义估值
    const entry = userVal?.otherBenefitValuations?.[benefitId];

    if (entry) {
        if (entry.valueCents != null) {
            return entry.valueCents;
        }
        if (entry.proportion != null) {
            // 福利的“面值”就是其默认价值
            const rawValue = benefit.defaultEffectiveValueCents ?? 0;
            return Math.round(rawValue * entry.proportion);
        }
    }
    // 2. 如果没有用户估值，则回退到默认价值
    return benefit.defaultEffectiveValueCents ?? 0;
};

/**
 * 计算信用卡的年度净值（ROI）。
 * 现在会综合考虑 Credits、OtherBenefits 和 CustomAdjustments 的价值。
 * @param card - 信用卡对象。
 * @param userValuation - 包含所有用户估值的数据库对象。
 * @returns 净值（以美分为单位）。
 */
export const calculateNetWorth = (
    card: cardverdict.v1.ICreditCard,
    userValuation: userprofile.v1.IUserCardValuation | undefined
): number => {

    // 计算所有 Credits 的总价值
    const totalCreditsValue = (card.credits ?? []).reduce(
        (sum, c) => sum + getDisplayEffectiveCents(c, userValuation),
        0
    );

    // 计算所有 OtherBenefits 的总价值
    const totalBenefitsValue = (card.otherBenefits ?? []).reduce(
        (sum, b) => sum + getDisplayEffectiveCentsForBenefit(b, userValuation),
        0
    );

    // 计算所有 CustomAdjustments 的总价值
    const totalCustomAdjustmentsValue = (userValuation?.customAdjustments ?? []).reduce((sum, adj) => {
        const periods = periodsInYearFor(adj.frequency ?? undefined);
        const annualValue = (adj.valueCents ?? 0) * periods;
        return sum + annualValue;
    }, 0);

    const annualFee = card.annualFeeCents || 0;
    // 返回包含所有部分的总净值
    return totalCreditsValue + totalBenefitsValue + totalCustomAdjustmentsValue - annualFee;
};
