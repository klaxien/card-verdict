import React, {useEffect, useState, useMemo} from 'react';
import {
    Typography,
    Grid,
    CircularProgress,
    Alert,
    Box,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    type SelectChangeEvent,
} from '@mui/material';
import {getCardDatabase} from "~/client/CardDetailsFetcher";
import {cardverdict, uservaluation} from "~/generated/bundle";
import CreditCardComponent from "~/components/homePanel/CreditCardComponent";
import {loadUserValuationDatabase} from "~/client/UserSettingsPersistence";

// --- Type definitions ---
type SortOrder = 'net-high-to-low' | 'net-low-to-high' | 'credits-high-to-low' | 'credits-low-to-high';
import CreditFrequency = cardverdict.v1.CreditFrequency;

// --- Helper Functions (to calculate net worth) ---

const PERIODS_PER_YEAR: Record<CreditFrequency, number> = {
    [CreditFrequency.FREQUENCY_UNSPECIFIED]: 0,
    [CreditFrequency.ANNUAL]: 1,
    [CreditFrequency.SEMI_ANNUAL]: 2,
    [CreditFrequency.QUARTERLY]: 4,
    [CreditFrequency.MONTHLY]: 12,
};

const periodsInYearFor = (frequency?: CreditFrequency | null): number =>
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
    if (entry?.cents != null) return entry.cents;
    if (entry?.proportion != null) {
        return Math.round(calcRawAnnualCents(credit) * entry.proportion);
    }
    return defaultEffectiveCents(credit);
};

const calculateNetWorth = (
    card: cardverdict.v1.ICreditCard,
    userDb: uservaluation.v1.IUserValuationDatabase | null
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


const HomePanel: React.FC = () => {
    const [cardData, setCardData] = useState<cardverdict.v1.CreditCardDatabase | null>(null);
    const [userValuationDb, setUserValuationDb] = useState<uservaluation.v1.IUserValuationDatabase | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [sortOrder, setSortOrder] = useState<SortOrder>('net-high-to-low');

    useEffect(() => {
        const fetchCardData = async () => {
            try {
                // Fetch main card data
                const data = await getCardDatabase();
                setCardData(data);

                // Load user valuations
                const db = loadUserValuationDatabase();
                setUserValuationDb(db);

            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load card data');
            } finally {
                setLoading(false);
            }
        };

        fetchCardData();
    }, []);

    const sortedCards = useMemo(() => {
        if (!cardData?.cards) return [];

        const cardsToSort = [...cardData.cards];

        cardsToSort.sort((a, b) => {
            switch (sortOrder) {
                case 'net-high-to-low':
                    return calculateNetWorth(b, userValuationDb) - calculateNetWorth(a, userValuationDb);
                case 'net-low-to-high':
                    return calculateNetWorth(a, userValuationDb) - calculateNetWorth(b, userValuationDb);
                case 'credits-high-to-low':
                    return (b.credits?.length ?? 0) - (a.credits?.length ?? 0);
                case 'credits-low-to-high':
                    return (a.credits?.length ?? 0) - (b.credits?.length ?? 0);
                default:
                    return 0;
            }
        });

        return cardsToSort;
    }, [cardData?.cards, userValuationDb, sortOrder]);


    if (loading) {
        return (
            <div className="flex justify-center items-center h-screen">
                <CircularProgress/>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4">
                <Alert severity="error">{error}</Alert>
            </div>
        );
    }

    return (
        <div className="p-4">
            <Box sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2}}>
                <Typography variant="h4" gutterBottom sx={{mb: 0}}>
                    Credit Cards
                </Typography>
                <FormControl size="small" sx={{m: 1, minWidth: 180}}>
                    <InputLabel id="sort-order-label">排序</InputLabel>
                    <Select
                        labelId="sort-order-label"
                        id="sort-order-select"
                        value={sortOrder}
                        label="排序"
                        onChange={(e: SelectChangeEvent<SortOrder>) => setSortOrder(e.target.value as SortOrder)}
                    >
                        <MenuItem value="net-high-to-low">净值 (从高到低)</MenuItem>
                        <MenuItem value="net-low-to-high">净值 (从低到高)</MenuItem>
                        <MenuItem value="credits-high-to-low">coupon数 (从高到低)</MenuItem>
                        <MenuItem value="credits-low-to-high">coupon数 (从低到高)</MenuItem>
                    </Select>
                </FormControl>
            </Box>

            <Grid container spacing={3}>
                {sortedCards.map((card) => (
                    // 使用 Grid item 来包裹每个卡片
                    // xs={12}: 在超小屏幕上 (extra-small), 每行1个卡片 (12/12)
                    // sm={6}: 在小屏幕上 (small), 每行2个卡片 (12/6)
                    // md={4}: 在中等及以上屏幕上 (medium), 每行3个卡片 (12/4)
                    <Grid key={card.cardId} size={{xs: 12, sm: 6, md: 4}}>
                        <CreditCardComponent
                            card={card}
                            initialValuation={userValuationDb?.cardValuations?.[card.cardId ?? '']}
                        />
                    </Grid>
                ))}
            </Grid>
        </div>
    );
};

export default HomePanel;
