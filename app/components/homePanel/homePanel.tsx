import React, { useEffect, useState } from 'react';
import { Typography, Grid, CircularProgress, Alert } from '@mui/material';
import { getCardDatabase } from "~/client/CardDetailsFetcher";
import { cardverdict } from "~/generated/bundle";
import CreditCardComponent from "~/components/homePanel/creditCardComponent";

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
                    <Grid item xs={12} key={index} sx={{ flexGrow: 1 }}>
                        <CreditCardComponent card={card} />
                    </Grid>
                ))}
            </Grid>
        </div>
    );
};

export default HomePanel;