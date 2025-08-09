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
import {calculateNetWorth} from "~/utils/cardCalculations";

// --- Type definitions ---
type SortOrder = 'net-high-to-low' | 'net-low-to-high' | 'credits-high-to-low' | 'credits-low-to-high';

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
