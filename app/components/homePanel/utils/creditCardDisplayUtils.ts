import {cardverdict, userprofile} from '~/generated/bundle';
import {
    calcRawAnnualCents,
    getDisplayEffectiveCents,
    getDisplayEffectiveCentsForBenefit
} from "~/utils/cardCalculations";
import CoverageType = cardverdict.v1.CarRentalInsuranceBenefit.CoverageType;
import TravelStatusBenefit = cardverdict.v1.TravelStatusBenefit;
import CarRentalInsuranceBenefit = cardverdict.v1.CarRentalInsuranceBenefit;

export const getCreditChipColor = (
    credit: cardverdict.v1.ICredit,
    userVal?: userprofile.v1.IUserCardValuation,
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

// 根据有效价值决定 Benefit Chip 的颜色
export const getBenefitChipColor = (
    benefit: cardverdict.v1.IOtherBenefit,
    userVal?: userprofile.v1.IUserCardValuation,
): 'success' | 'warning' | 'error' | 'primary' => {
    const effective = getDisplayEffectiveCentsForBenefit(benefit, userVal);
    if (effective === 0) return 'primary';

    const raw = benefit.defaultEffectiveValueCents ?? 0;
    if (raw === 0) {
        return effective > 0 ? 'success' : 'error';
    }

    const proportion = effective / raw;
    if (proportion >= 0.8) return 'success';
    if (proportion >= 0.2) return 'warning';
    return 'error';
};

export const getBenefitDisplayDetails = (benefit: cardverdict.v1.IOtherBenefit): string => {
    if (benefit.genericBenefitDescription) {
        return benefit.genericBenefitDescription;
    }
    if (benefit.travelStatus?.description) {
        return benefit.travelStatus.description;
    }
    if (benefit.pointPerk?.description) {
        return benefit.pointPerk.description;
    }
    if (benefit.carRentalInsurance) {
        const carRentalInsurance = benefit.carRentalInsurance;
        const type = carRentalInsurance.coverageType === CoverageType.PRIMARY ? 'Primary' : 'Secondary';
        return `${type}租车险${carRentalInsurance.notes ? `，${carRentalInsurance.notes}` : ''}`;
    }
    if (benefit.loungeAccess) {
        const {LoungeNetwork, AdditionalService} = cardverdict.v1.LoungeAccessBenefit;
        const networkNumber = benefit.loungeAccess.network ?? LoungeNetwork.NETWORK_UNSPECIFIED;
        const networkEnumKey = LoungeNetwork[networkNumber];

        let loungeName = '[未知Lounge]';
        if (networkEnumKey && networkNumber !== LoungeNetwork.NETWORK_UNSPECIFIED) {
            loungeName = networkEnumKey
                .toLowerCase()
                .split('_')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
        }

        const detailsParts = [`可进${loungeName}`];

        const guestCount = benefit.loungeAccess.guestCount ?? 0;
        if (guestCount < 0) {
            detailsParts.push('可无限带人');
        } else if (guestCount >= 0) {
            detailsParts.push(`可带${guestCount}人`);
        }

        if (benefit.loungeAccess.network === LoungeNetwork.PRIORITY_PASS_SELECT) {
            const hasRestaurant = benefit.loungeAccess.includedServices?.includes(AdditionalService.RESTAURANT);
            detailsParts.push(hasRestaurant ? '可进餐厅' : '不可进餐厅');
        }

        return [...detailsParts, ...(benefit.loungeAccess.notes ?? [])].join('，');
    }
    if (benefit.feeReimbursement?.details) {
        return `Fee Reimbursement (${benefit.feeReimbursement.details})`;
    }
    if (benefit.baggage) {
        return `航司执飞航班，${benefit.baggage.freeCheckedBagsCount || ''}件托运行李免费`.trim();
    }
    // Fallback using the ID, converting it to title case.
    return benefit.benefitId?.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) ?? 'Unnamed Benefit';
};

export const getTooltipForBenefit = (
    benefit: cardverdict.v1.IOtherBenefit,
    userVal?: userprofile.v1.IUserCardValuation,
): string => {
    const benefitId = benefit.benefitId ?? '';
    const userNote = userVal?.otherBenefitValuations?.[benefitId]?.explanation?.trim();
    if (userNote) return userNote; // 优先显示用户备注

    const userBenefitVal = userVal?.otherBenefitValuations?.[benefitId];
    if (userBenefitVal?.valueCents != null || userBenefitVal?.proportion != null) {
        return '自定义估值（未输入原因）';
    }
    // 回退到默认解释
    return benefit.defaultEffectiveValueExplanation ?? getBenefitDisplayDetails(benefit);
};

export function shouldDisplayBenefit(benefit: cardverdict.v1.IOtherBenefit): boolean {

    if (benefit.feeReimbursement || benefit.pointPerk) return false;
    if (benefit.travelStatus && benefit.travelStatus.type !== TravelStatusBenefit.StatusType.HOTEL_ELITE_STATUS) return false;
    if (benefit.carRentalInsurance) {
        if (benefit.carRentalInsurance.coverageType == CarRentalInsuranceBenefit.CoverageType.PRIMARY) return true;
        return !!benefit.carRentalInsurance.notes;
    }
    return true;
}

export function getCustomAdjustmentChipColor(annualValueCents: number): 'success' | 'error' | 'primary' {
    if (annualValueCents > 0) return 'success';
    if (annualValueCents < 0) return 'error';
    return 'primary';
}

export function colorRank(credit: cardverdict.v1.ICredit, userVal?: userprofile.v1.IUserCardValuation): number {
    const color = getCreditChipColor(credit, userVal);
    return color === 'success' ? 3 : color === 'warning' ? 2 : color === 'error' ? 1 : 0;
}

export function getTooltipForCredit(
    credit: cardverdict.v1.ICredit,
    userVal?: userprofile.v1.IUserCardValuation,
): string {
    const creditId = credit.creditId ?? '';
    const creditValuation = userVal?.creditValuations?.[creditId];
    const userNote = userVal?.creditValuations?.[creditId]?.explanation?.trim();
    if (userNote && userNote.length > 0) return userNote;
    if (creditValuation?.valueCents || creditValuation?.proportion) return '自定义估值（未输入原因）';
    return credit.defaultEffectiveValueExplanation ?? '';
}

export function formatWithoutTrailingZeroes(number: number): string {
    return parseFloat(number.toFixed(2)).toString();
}