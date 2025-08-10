// test/data/database_validation.test.ts

import {beforeAll, describe, expect, it} from 'vitest';
import {getCardDatabase} from '~/client/cardDetailsFetcher';
import {cardverdict, cardverdict as pb} from '~/generated/bundle';
import SpendingCategory = cardverdict.v1.EarningRate.SpendingCategory;
import Channel = cardverdict.v1.EarningRate.Channel;

// 类型别名
type CreditCardDatabase = pb.v1.ICreditCardDatabase;
type CreditCard = pb.v1.ICreditCard;

// 声明变量
let db: CreditCardDatabase;

// 在所有测试开始前获取数据
beforeAll(async () => {
    db = await getCardDatabase();
});

describe('CreditCardDatabase Data Validation', () => {

    it('should successfully load the database', () => {
        expect(db).toBeDefined();
        expect(db.cards).toBeInstanceOf(Array);
        if ((db.cards?.length ?? 0) === 0) {
            console.warn("Warning: The test database is empty. Validation tests will be skipped.");
        }
    });

    // --- 测试 1: 所有ID的非空与唯一性 ---
    it('should ensure all entities have a non-empty and unique ID where required', () => {
        for (const card of db.cards as CreditCard[]) {
            // 1a: Card ID (已在之前的测试中覆盖，这里作为完整性再次列出)
            expect(card.cardId, `Card "${card.name}" is missing its cardId.`).not.toBeFalsy();
            expect(card.name, `Card "${card.name}" is missing its name.`).not.toBeFalsy();
            expect(card.imageName, `Card "${card.imageName}" is missing its imageName.`).not.toBeFalsy();
            expect(card.annualFeeCents, `Card "${card.annualFeeCents}" is missing its annualFeeCents.`).toBeDefined();
            expect(card.annualFeeCents, `Card "${card.annualFeeCents}" is missing its annualFeeCents.`).not.toBeNull();

            // 1b: PointSystemInfo ID
            if (card.pointSystemInfo) {
                expect(card.pointSystemInfo.systemId, `Point system for card "${card.name}" is missing its systemId.`)
                    .not.toBeFalsy();
            }

            // 1c: Credit相关检查
            if (card.credits && card.credits.length > 0) {
                const creditIds = new Set<string>();
                for (const credit of card.credits) {
                    expect(credit.details).toBeTruthy();
                    const id = credit.creditId!;
                    expect(id, `A credit in card "${card.name}" is missing its creditId.`).not.toBeFalsy();
                    expect(creditIds.has(id), `Duplicate creditId "${id}" found in card "${card.name}".`)
                        .toBe(false);
                    creditIds.add(id);
                }
            }

            // 1d: OtherBenefit IDs (在卡内唯一)
            if (card.otherBenefits && card.otherBenefits.length > 0) {
                const benefitIds = new Set<string>();
                for (const benefit of card.otherBenefits) {
                    const id = benefit.benefitId!;
                    expect(id, `An otherBenefit in card "${card.name}" is missing its benefitId.`).not.toBeFalsy();
                    expect(benefitIds.has(id), `Duplicate benefitId "${id}" found in card "${card.name}".`)
                        .toBe(false);
                    benefitIds.add(id);
                }
            }

            // 1e: EarningRate IDs (在卡内唯一)
            if (card.earningRates && card.earningRates.length > 0) {
                const earningRateIds = new Set<string>();
                for (const rate of card.earningRates) {
                    const id = rate.earningRateId!;
                    expect(id, `An earningRate in card "${card.name}" is missing its earningRateId.`).not.toBeFalsy();
                    expect(earningRateIds.has(id), `Duplicate earningRateId "${id}" found in card "${card.name}".`)
                        .toBe(false);
                    earningRateIds.add(id);
                }
            }
        }
    });

    // --- 测试 2: CreditFrequency 的有效性 ---
    it('should ensure all credits have a specified frequency', () => {
        for (const card of db.cards as CreditCard[]) {
            if (!card.credits) continue;
            for (const credit of card.credits) {
                const freq = credit.frequency;
                expect(freq, `Credit "${credit.creditId}" on card "${card.name}" is missing the frequency field.`)
                    .toBeDefined();

                // .toJSON() 会把枚举值转换为字符串，所以我们可以直接比较字符串
                // 'FREQUENCY_UNSPECIFIED' 对应的值是 0
                expect(freq, `Credit "${credit.creditId}" on card "${card.name}" has an unspecified frequency.`)
                    .not.toBe('FREQUENCY_UNSPECIFIED');
                expect(freq).not.toBe(0);
            }
        }
    });

    // --- 测试 3: default_period_value_cents 的有效性 (包含例外情况) ---
    it('should ensure credits have a valid default period value', () => {
        for (const card of db.cards as CreditCard[]) {
            if (!card.credits) continue;
            for (const credit of card.credits) {
                const val = credit.defaultPeriodValueCents;
                expect(val, `Credit "${credit.creditId}" on card "${card.name}" is missing defaultPeriodValueCents.`)
                    .toBeDefined();

                // 如果一个credit没有任何overrides，那么它的默认周期价值必须是正数
                if (!credit.overrides || credit.overrides.length === 0) {
                    expect(val, `Credit "${credit.creditId}" on card "${card.name}" has no overrides, so its defaultPeriodValueCents must be > 0.`)
                        .toBeGreaterThan(0);
                } else {
                    // 如果有overrides，那么默认值可以是0或者正数，但不能是负数
                    expect(val, `Credit "${credit.creditId}" on card "${card.name}" has a negative defaultPeriodValueCents.`)
                        .toBeGreaterThanOrEqual(0);
                }
            }
        }
    });

    it('should ensure every credit has at least one default effective value defined', () => {
        for (const card of db.cards as CreditCard[]) {
            if (!card.credits) continue;

            for (const credit of card.credits) {
                // 直接检查两个可能的估值字段
                // 使用 `!== null` 和 `!== undefined` 来最精确地判断字段是否存在
                const hasProportion = credit.defaultEffectiveValueProportion !== null && credit.defaultEffectiveValueProportion !== undefined;
                const hasCents = credit.defaultEffectiveValueCents !== null && credit.defaultEffectiveValueCents !== undefined;

                // 断言：两者之中至少有一个必须为 true
                const isValueDefined = hasProportion || hasCents;

                expect(isValueDefined, `Credit "${credit.creditId}" on card "${card.name}" must have either 'defaultEffectiveValueProportion' or 'defaultEffectiveValueCents' set.`)
                    .toBe(true);
            }
        }
    });

    it("should ensure every card has a default 'ALL_OTHER, GENERAL' earning rate", () => {
        for (const card of db.cards as CreditCard[]) {

            // 检查 earningRates 数组是否存在且不为空
            expect(card.earningRates, `Card "${card.name}" has no 'earningRates' array defined.`)
                .toBeDefined();
            expect(card.earningRates!.length, `Card "${card.name}" has an empty 'earningRates' array.`)
                .toBeGreaterThan(0);

            // 使用 .some() 方法来高效地检查是否存在至少一个符合条件的元素
            const hasDefaultRate = (card.earningRates)?.some(rate =>
                // 条件1: category 必须是 'ALL_OTHER' (枚举的字符串表示)
                rate.category === SpendingCategory.ALL_OTHER &&
                // 条件2: channel 必须是 'GENERAL'
                rate.channel === Channel.GENERAL
            );

            // 核心断言：查找结果必须为 true
            // 提供一个清晰的错误信息，指明是哪张卡出了问题
            expect(hasDefaultRate, `Card "${card.name}" is missing its required default earning rate (Category: ALL_OTHER, Channel: GENERAL).`)
                .toBe(true);
        }
    });
});
