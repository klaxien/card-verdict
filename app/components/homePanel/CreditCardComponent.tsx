import React, {useEffect, useMemo, useState} from 'react';
import {Box, Card, CardContent, Chip, Divider, Grid, CardMedia, Stack, Tooltip, Typography, IconButton} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import {cardverdict, userprofile} from '~/generated/bundle';
import ValuationEditComponent from './valudationEditor/ValuationEditComponent';
import {loadActiveValuationProfile, saveValuationProfile} from '~/client/UserSettingsPersistence';
import {calcRawAnnualCents, getDisplayEffectiveCents, periodsInYearFor} from "~/utils/cardCalculations";
import CreditFrequency = cardverdict.v1.CreditFrequency;

const genericImageName = 'generic_credit_card_picryl_66dea8.png';

// --- Reusable Item Display ---

type DisplayItem = {
    id: string;
    details: string;
    valueCents: number;
    tooltip: string;
    chipColor: 'success' | 'warning' | 'error' | 'primary';
    isLast: boolean;
    onClick?: () => void;
};

const ItemRow: React.FC<{ item: DisplayItem, chipWidth: string }> = ({item, chipWidth}) => (
    <Box key={item.id}>
        <Grid alignItems="baseline" justifyContent="space-between" display="flex" gap={1}>
            <Grid flexGrow={1} size={{xs: 10}}>
                <Typography variant="body2" sx={{wordBreak: 'break-word'}}>
                    {item.details}
                </Typography>
            </Grid>
            <Grid flexShrink={0} flexGrow={1}>
                <Tooltip title={item.tooltip}>
                    <Chip
                        label={`$${(item.valueCents / 100).toFixed(0)}`}
                        size="small"
                        color={item.chipColor}
                        sx={{width: chipWidth, textAlign: 'center', cursor: item.onClick ? 'pointer' : 'default'}}
                        onClick={item.onClick}
                    />
                </Tooltip>
            </Grid>
        </Grid>
        {!item.isLast && <Divider sx={{mb: 1, mt: 1}}/>}
    </Box>
);


// --- Helper Functions ---

const getCreditChipColor = (
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

const getCustomAdjustmentChipColor = (annualValueCents: number): 'success' | 'error' | 'primary' => {
    if (annualValueCents > 0) return 'success';
    if (annualValueCents < 0) return 'error';
    return 'primary';
};

const colorRank = (credit: cardverdict.v1.ICredit, userVal?: userprofile.v1.IUserCardValuation): number => {
    const color = getCreditChipColor(credit, userVal);
    return color === 'success' ? 3 : color === 'warning' ? 2 : color === 'error' ? 1 : 0;
};

const getTooltipForCredit = (
    credit: cardverdict.v1.ICredit,
    userVal?: userprofile.v1.IUserCardValuation,
): string => {
    const creditId = credit.creditId ?? '';
    const creditValuation = userVal?.creditValuations?.[creditId];
    const userNote = userVal?.creditValuations?.[creditId]?.explanation?.trim();
    if(userNote && userNote.length > 0) return userNote;
    if(creditValuation?.cents || creditValuation?.proportion) return '自定义估值（未输入原因）';
    return credit.defaultEffectiveValueExplanation ?? '';
};


// --- Main Component ---

type CreditCardComponentProps = {
    card: cardverdict.v1.ICreditCard;
    onSaveValuation?: (valuation: userprofile.v1.IUserCardValuation, card: cardverdict.v1.ICreditCard) => void;
    initialValuation?: userprofile.v1.IUserCardValuation;
};

const CreditCardComponent: React.FC<CreditCardComponentProps> = ({card, onSaveValuation, initialValuation}) => {
    const [editOpen, setEditOpen] = useState(false);
    const [editingCreditId, setEditingCreditId] = useState<string | null>(null);
    const [editingCustomAdjustmentId, setEditingCustomAdjustmentId] = useState<string | null>(null);

    // This is the key state. It will be initialized from props, then updated from localStorage.
    const [userValuation, setUserValuation] = useState<userprofile.v1.IUserCardValuation | undefined>(initialValuation);

    // Effect for loading valuation from localStorage on component mount
    useEffect(() => {
        // We only try to load from local storage if no initial valuation was provided via props.
        if (!initialValuation) {
            const db = loadActiveValuationProfile();
            if (db && card.cardId) {
                const cardValuation = db.cardValuations?.[card.cardId];
                if (cardValuation) {
                    setUserValuation(cardValuation);
                }
            }
        }
    }, [card.cardId, initialValuation]);

    // --- Calculations ---

    const totalCreditsValue = useMemo(() => {
        const credits = card.credits ?? [];
        return credits.reduce((sum, c) => sum + getDisplayEffectiveCents(c, userValuation), 0);
    }, [card.credits, userValuation]);

    const totalCustomAdjustmentsValue = useMemo(() => {
        const adjustments = userValuation?.customAdjustments ?? [];
        if (!adjustments) return 0;
        return adjustments.reduce((sum, adj) => {
            const periods = periodsInYearFor(adj.frequency ?? undefined);
            const annualValue = (adj.valueCents ?? 0) * periods;
            return sum + annualValue;
        }, 0);
    }, [userValuation?.customAdjustments]);

    const annualFee = card.annualFeeCents || 0;
    const roi = totalCreditsValue + totalCustomAdjustmentsValue - annualFee;

    // --- Display Data Preparation ---

    const sortedCredits = useMemo(() => {
        const credits = card.credits ?? [];
        return [...credits].sort((a, b) => {
            const rankDiff = colorRank(b, userValuation) - colorRank(a, userValuation);
            if (rankDiff !== 0) return rankDiff;
            const aVal = getDisplayEffectiveCents(a, userValuation);
            const bVal = getDisplayEffectiveCents(b, userValuation);
            return bVal - aVal;
        });
    }, [card.credits, userValuation]);

    const sortedCustomAdjustments = useMemo(() => {
        const adjustments = userValuation?.customAdjustments ?? [];
        if (!adjustments) return [];
        return [...adjustments].sort((a, b) => {
            const aVal = (a.valueCents ?? 0) * periodsInYearFor(a.frequency);
            const bVal = (b.valueCents ?? 0) * periodsInYearFor(b.frequency);
            return bVal - aVal;
        });
    }, [userValuation?.customAdjustments]);

    const hasAnyFourPlusDigits = useMemo(() => {
        const credits = card.credits ?? [];
        for (const c of credits) {
            const cents = getDisplayEffectiveCents(c, userValuation);
            const dollarsRounded = Math.round(cents / 100);
            if (Math.abs(dollarsRounded).toString().length >= 4) return true;
        }
        const adjustments = userValuation?.customAdjustments ?? [];
        if (adjustments) {
            for (const adj of adjustments) {
                const periods = periodsInYearFor(adj.frequency ?? undefined);
                const annualValueCents = (adj.valueCents ?? 0) * periods;
                const dollarsRounded = Math.round(annualValueCents / 100);
                if (Math.abs(dollarsRounded).toString().length >= 4) return true;
            }
        }
        return false;
    }, [card.credits, userValuation]);

    const chipWidth = hasAnyFourPlusDigits ? '5em' : '4em';

    const creditDisplayItems: DisplayItem[] = sortedCredits.map((credit, index) => ({
        id: credit.creditId ?? `credit-${index}`,
        details: credit.details ?? '',
        valueCents: getDisplayEffectiveCents(credit, userValuation),
        tooltip: getTooltipForCredit(credit, userValuation),
        chipColor: getCreditChipColor(credit, userValuation),
        isLast: index === sortedCredits.length - 1,
        onClick: () => setEditingCreditId(credit.creditId ?? null),
    }));

    const customDisplayItems: DisplayItem[] = sortedCustomAdjustments.map((adj, index) => {
        const annualValue = (adj.valueCents ?? 0) * periodsInYearFor(adj.frequency);
        return {
            id: adj.customAdjustmentId ?? `custom-${index}`,
            details: adj.description ?? '自定义项',
            valueCents: annualValue,
            tooltip: adj.notes || adj.description || '自定义调整项',
            chipColor: getCustomAdjustmentChipColor(annualValue),
            isLast: index === sortedCustomAdjustments.length - 1,
            onClick: () => setEditingCustomAdjustmentId(adj.customAdjustmentId ?? null),
        };
    });

    // --- Handlers ---

    const handleSaveValuation = (valuation: userprofile.v1.IUserCardValuation) => {
        if (!card.cardId) {
            console.error("Cannot save valuation for a card without a cardId.");
            return;
        }
        setUserValuation(valuation);
        const db = loadActiveValuationProfile() ?? {cardValuations: {}, pointSystemValuations: {}};
        if (!db.cardValuations) {
            db.cardValuations = {};
        }
        db.cardValuations[card.cardId] = valuation;
        saveValuationProfile(db);
        onSaveValuation?.(valuation, card);
    };

    // --- Render ---

    return (
        <Card sx={{height: '100%', display: 'flex', flexDirection: 'column', boxShadow: 2, borderRadius: 4, position: 'relative'}}>
            <CardContent sx={{flexGrow: 1, display: 'flex', flexDirection: 'column'}}>
                <Box sx={{position: 'absolute', top: 8, right: 8, zIndex: 1}}>
                    <Tooltip title="编辑">
                        <IconButton
                            aria-label="edit card"
                            size="small"
                            color="primary"
                            onClick={() => setEditOpen(true)}
                        >
                            <EditIcon fontSize="small"/>
                        </IconButton>
                    </Tooltip>
                </Box>

                <Grid container spacing={2} alignItems="center" flexWrap="nowrap">
                    <Grid size={4} flexShrink={0}>
                        <CardMedia
                            component="img"
                            image={`images/${card.imageName || genericImageName}`}
                            alt={`${card.name} card image`}
                            sx={{width: 125, objectFit: 'fill', aspectRatio: '1.586/1', borderRadius: '4px', boxShadow: 3}}
                        />
                    </Grid>
                    <Grid>
                        <Typography variant="subtitle1" component="div" sx={{fontWeight: 'bold', wordBreak: 'break-word'}}>
                            {card.name}
                        </Typography>
                    </Grid>
                </Grid>

                <Grid container spacing={2} sx={{my: 2, textAlign: 'center'}}>
                    <Grid size={{xs: 6}}>
                        <Typography variant="body2" color="text.secondary">年费</Typography>
                        <Typography variant="h6" sx={{fontWeight: 'bold'}}>
                            {card.annualFeeCents != null ? `$${(card.annualFeeCents / 100).toFixed(0)}` : 'N/A'}
                        </Typography>
                    </Grid>
                    <Grid size={{xs: 6}}>
                        <Typography variant="body2" color="text.secondary">净值</Typography>
                        <Typography variant="h5" sx={{fontWeight: 'bold', color: roi >= 0 ? 'success.main' : 'error.main'}}>
                            ${(roi / 100).toFixed(0)}
                        </Typography>
                    </Grid>
                </Grid>

                <Divider sx={{mb: 2}}/>

                <Box sx={{flexGrow: 1, overflowY: 'auto', minHeight: 0}}>
                    <Stack spacing={2}>
                        <Box>
                            <Typography variant="h6" component="div" gutterBottom sx={{ display: 'inline-block', borderBottom: '2px solid', borderColor: 'primary.main' }}>
                                Credits
                            </Typography>
                            {creditDisplayItems.length > 0 ? (
                                <Stack>
                                    {creditDisplayItems.map((item) => (
                                        <ItemRow key={item.id} item={item} chipWidth={chipWidth} />
                                    ))}
                                </Stack>
                            ) : (
                                <Typography variant="body2">No credits available.</Typography>
                            )}
                        </Box>

                        {customDisplayItems.length > 0 && (
                            <Box>
                                <Typography variant="h6" component="div" gutterBottom sx={{ display: 'inline-block', borderBottom: '2px solid', borderColor: 'primary.main' }}>
                                    Additional
                                </Typography>
                                <Stack>
                                    {customDisplayItems.map((item) => (
                                        <ItemRow key={item.id} item={item} chipWidth={chipWidth} />
                                    ))}
                                </Stack>
                            </Box>
                        )}
                    </Stack>
                </Box>
            </CardContent>

            {/* 把最新的用户估值作为 initialValuation 回传，保证二次打开能回显 */}
            <ValuationEditComponent
                open={editOpen}
                card={card}
                displayCredits={sortedCredits}
                initialValuation={userValuation}
                onCustomValuationClear={() => setUserValuation(undefined)}
                onClose={() => setEditOpen(false)}
                onSave={handleSaveValuation}
            />
            {/* 单个 credit 编辑对话框 */}
            <ValuationEditComponent
                open={!!editingCreditId}
                card={card}
                displayCredits={sortedCredits}
                initialValuation={userValuation}
                onCustomValuationClear={() => setUserValuation(undefined)}
                onClose={() => setEditingCreditId(null)}
                onSave={handleSaveValuation}
                singleCreditIdToEdit={editingCreditId ?? undefined}
            />
            {/* 单个 custom adjustment 编辑对话框 */}
            <ValuationEditComponent
                open={!!editingCustomAdjustmentId}
                card={card}
                displayCredits={sortedCredits}
                initialValuation={userValuation}
                onCustomValuationClear={() => setUserValuation(undefined)} // 新增
                onClose={() => setEditingCustomAdjustmentId(null)}
                onSave={handleSaveValuation}
                singleCustomAdjustmentIdToEdit={editingCustomAdjustmentId ?? undefined}
            />
        </Card>
    );
};

export default CreditCardComponent;
