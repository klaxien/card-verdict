import React, { useEffect, useState } from 'react';
import { Typography, Grid, CircularProgress, Alert } from '@mui/material';
import { getCardDatabase } from "~/client/CardDetailsFetcher";
import { cardverdict } from "~/generated/bundle";
import CreditCardComponent from "~/components/homePanel/CreditCardComponent";

const HomePanel: React.FC = () => {
    const [cardData, setCardData] = useState<cardverdict.v1.CreditCardDatabase | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchCardData = async () => {
            try {
                const data = await getCardDatabase();
                setCardData(data);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load card data');
            } finally {
                setLoading(false);
            }
        };

        fetchCardData();
    }, []);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-screen">
                <CircularProgress />
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
            <Typography variant="h4" gutterBottom>
                Credit Cards
            </Typography>

        <Grid container spacing={3}>
            {cardData?.cards?.map((card, index) => (
                // 使用 Grid item 来包裹每个卡片
                // xs={12}: 在超小屏幕上 (extra-small), 每行1个卡片 (12/12)
                // sm={6}: 在小屏幕上 (small), 每行2个卡片 (12/6)
                // md={4}: 在中等及以上屏幕上 (medium), 每行3个卡片 (12/4)
                <Grid item key={index} size={{ xs: 12, sm:6, md:4 }} >
                    <CreditCardComponent card={card} />
                </Grid>
            ))}
        </Grid>
        </div>
    );
};

export default HomePanel;