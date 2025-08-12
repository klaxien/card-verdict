import React, {useEffect, useMemo, useState} from 'react';
import {
    Box,
    Card,
    CardContent,
    CardMedia,
    Chip,
    Divider,
    Grid,
    IconButton,
    List,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Menu,
    MenuItem,
    Stack,
    SwipeableDrawer,
    Tooltip,
    Typography,
    useMediaQuery
} from '@mui/material';
import {useTheme} from '@mui/material/styles';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import EditIcon from '@mui/icons-material/Edit';
import CalculateIcon from '@mui/icons-material/Calculate';
import ShareIcon from '@mui/icons-material/Share';
import {cardverdict, userprofile} from '~/generated/bundle';
import ValuationEditComponent from './valudationEditor/ValuationEditComponent';
import {loadActiveValuationProfile, saveValuationProfile} from '~/client/userSettingsPersistence';
import {
    calculateNetWorth,
    getDisplayEffectiveCents,
    getDisplayEffectiveCentsForBenefit,
    periodsInYearFor
} from "~/utils/cardCalculations";
import CashBackEditor from "~/components/homePanel/cashBackEditor/CashBackEditor";
import ShareValuation from "~/components/homePanel/shareDialog/ShareCardValuation";
import {
    colorRank,
    getBenefitChipColor,
    getBenefitDisplayDetails,
    getCreditChipColor,
    getCustomAdjustmentChipColor,
    getTooltipForBenefit,
    getTooltipForCredit,
    shouldHideBenefit
} from "~/components/homePanel/utils/creditCardDisplayUtils";

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


// --- Main Component ---

type CreditCardComponentProps = {
    card: cardverdict.v1.ICreditCard;
    onSaveValuation?: (valuation: userprofile.v1.IUserCardValuation, card: cardverdict.v1.ICreditCard) => void;
    initialValuation?: userprofile.v1.IUserCardValuation;
    pointSystemValuations?: userprofile.v1.IValuationProfile['pointSystemValuations'];
};

const CreditCardComponent: React.FC<CreditCardComponentProps> = ({
                                                                     card,
                                                                     onSaveValuation,
                                                                     initialValuation,
                                                                     pointSystemValuations
                                                                 }) => {
    const [editOpen, setEditOpen] = useState(false);
    const [editingCreditId, setEditingCreditId] = useState<string | null>(null);
    const [editingBenefitId, setEditingBenefitId] = useState<string | null>(null);
    const [editingCustomAdjustmentId, setEditingCustomAdjustmentId] = useState<string | null>(null);

    // New dialog states
    const [cashbackOpen, setCashbackOpen] = useState(false);
    const [shareOpen, setShareOpen] = useState(false);

    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    // desktop menu state
    const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
    const menuOpen = Boolean(menuAnchorEl);

    // mobile bottom sheet state
    const [sheetOpen, setSheetOpen] = useState(false);

    const openActions = (e: React.MouseEvent<HTMLElement>) => {
        if (isMobile) {
            setSheetOpen(true);
        } else {
            setMenuAnchorEl(e.currentTarget);
        }
    };
    const closeActions = () => {
        setMenuAnchorEl(null);
        setSheetOpen(false);
    };

    const handleEditValuation = () => {
        setEditOpen(true);
        closeActions();
    };

    const handleCalculateCashback = () => {
        setCashbackOpen(true);
        closeActions();
    };

    const handleShare = () => {
        setShareOpen(true);
        closeActions();
    };

    // This is the key state. It will be initialized from props, then updated from localStorage.
    const [userValuation, setUserValuation] = useState<userprofile.v1.IUserCardValuation | undefined>(initialValuation);

    useEffect(() => {
        setUserValuation(initialValuation);
    }, [initialValuation]);

    // --- Calculations ---

    const roi = calculateNetWorth(card, userValuation);

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

    const sortedBenefits = useMemo(() => {
        // userValuation is not used here because otherBenefits are not currently user-editable.
        const benefits = card.otherBenefits ?? [];
        return [...benefits]
            .filter(shouldHideBenefit)
            .sort((a, b) => {
            const aVal = a.defaultEffectiveValueCents ?? 0;
            const bVal = b.defaultEffectiveValueCents ?? 0;
            return bVal - aVal;
        });
    }, [card.otherBenefits, userValuation]);


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

    const benefitDisplayItems: DisplayItem[] = useMemo(() => {
        return sortedBenefits.map((benefit, index) => ({
            id: benefit.benefitId ?? `benefit-${index}`,
            details: getBenefitDisplayDetails(benefit),
            valueCents: getDisplayEffectiveCentsForBenefit(benefit, userValuation),
            tooltip: getTooltipForBenefit(benefit, userValuation),
            chipColor: getBenefitChipColor(benefit, userValuation),
            isLast: index === sortedBenefits.length - 1,
            onClick: () => setEditingBenefitId(benefit.benefitId ?? null),
        }));
    }, [sortedBenefits, userValuation]);

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

    // --- Unified Save Handler ---

    const handleSave = (updates: {
        cardValuation?: userprofile.v1.IUserCardValuation,
        pointSystemValuations?: userprofile.v1.IValuationProfile['pointSystemValuations']
    }) => {
        if (!card.cardId) {
            console.error("Cannot save valuation for a card without a cardId.");
            return;
        }

        const profile = loadActiveValuationProfile() ?? {
            profileId: crypto.randomUUID(), // Use UUID for new profiles as per proto spec
            displayName: 'My Valuation',
            cardValuations: {},
            pointSystemValuations: {},
        };

        const updatedProfile: userprofile.v1.IValuationProfile = {
            ...profile,
            pointSystemValuations: updates.pointSystemValuations ?? profile.pointSystemValuations,
            cardValuations: updates.cardValuation
                ? {
                    ...(profile.cardValuations ?? {}),
                    [card.cardId]: updates.cardValuation,
                }
                : profile.cardValuations,
        };

        saveValuationProfile(updatedProfile);

        if (updates.cardValuation) {
            setUserValuation(updates.cardValuation);
            onSaveValuation?.(updates.cardValuation, card);
        }
    };

    // --- Render ---

    return (
        <Card sx={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: 2,
            borderRadius: 4,
            position: 'relative'
        }}>
            <CardContent sx={{flexGrow: 1, display: 'flex', flexDirection: 'column'}}>
                <Box sx={{position: 'absolute', top: 6, right: 6, zIndex: 1}}>
                    <Tooltip title="更多">
                        <IconButton
                            aria-label="more actions"
                            aria-controls={menuOpen ? 'card-menu' : undefined}
                            aria-haspopup="true"
                            aria-expanded={menuOpen ? 'true' : undefined}
                            size="small"
                            color="primary"
                            onClick={openActions}
                        >
                            <MoreVertIcon fontSize="small"/>
                        </IconButton>
                    </Tooltip>

                    {/* Desktop menu */}
                    <Menu
                        id="card-menu"
                        anchorEl={menuAnchorEl}
                        open={!isMobile && menuOpen}
                        onClose={closeActions}
                        anchorOrigin={{vertical: 'bottom', horizontal: 'right'}}
                        transformOrigin={{vertical: 'top', horizontal: 'right'}}
                    >
                        <MenuItem onClick={handleEditValuation}>
                            <ListItemIcon><EditIcon fontSize="small"/></ListItemIcon>
                            <ListItemText>编辑估值</ListItemText>
                        </MenuItem>
                        <MenuItem onClick={handleCalculateCashback}>
                            <ListItemIcon><CalculateIcon fontSize="small"/></ListItemIcon>
                            <ListItemText>计算返现</ListItemText>
                        </MenuItem>
                        <MenuItem onClick={handleShare}>
                            <ListItemIcon><ShareIcon fontSize="small"/></ListItemIcon>
                            <ListItemText>分享</ListItemText>
                        </MenuItem>
                    </Menu>

                    {/* Mobile bottom sheet */}
                    <SwipeableDrawer
                        anchor="bottom"
                        open={isMobile && sheetOpen}
                        onOpen={() => setSheetOpen(true)}
                        onClose={closeActions}
                        disableDiscovery={false}
                        PaperProps={{sx: {borderTopLeftRadius: 12, borderTopRightRadius: 12}}}
                    >
                        <List>
                            <ListItemButton onClick={handleEditValuation}>
                                <ListItemIcon><EditIcon/></ListItemIcon>
                                <ListItemText primary="编辑估值"/>
                            </ListItemButton>
                            <ListItemButton onClick={handleCalculateCashback}>
                                <ListItemIcon><CalculateIcon/></ListItemIcon>
                                <ListItemText primary="计算返现"/>
                            </ListItemButton>
                            <ListItemButton onClick={handleShare}>
                                <ListItemIcon><ShareIcon/></ListItemIcon>
                                <ListItemText primary="分享"/>
                            </ListItemButton>
                        </List>
                    </SwipeableDrawer>
                </Box>

                <Grid container spacing={2} alignItems="center" flexWrap="nowrap">
                    <Grid size={4} flexShrink={0}>
                        <CardMedia
                            component="img"
                            image={`images/${card.imageName || genericImageName}`}
                            alt={`${card.name} card image`}
                            sx={{
                                width: 125,
                                objectFit: 'fill',
                                aspectRatio: '1.586/1',
                                borderRadius: '4px',
                                boxShadow: 3
                            }}
                        />
                    </Grid>
                    <Grid>
                        <Typography variant="subtitle1" component="div"
                                    sx={{fontWeight: 'bold', wordBreak: 'break-word'}}>
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
                        <Typography variant="h5"
                                    sx={{fontWeight: 'bold', color: roi >= 0 ? 'success.main' : 'error.main'}}>
                            ${(roi / 100).toFixed(0)}
                        </Typography>
                    </Grid>
                </Grid>

                <Divider sx={{mb: 2}}/>

                <Box sx={{flexGrow: 1, overflowY: 'auto', minHeight: 0}}>
                    <Stack spacing={2}>
                        <Box>
                            <Typography variant="h6" component="div" gutterBottom sx={{
                                display: 'inline-block',
                                borderBottom: '2px solid',
                                borderColor: 'primary.main'
                            }}>
                                Credits
                            </Typography>
                            {creditDisplayItems.length > 0 ? (
                                <Stack>
                                    {creditDisplayItems.map((item) => (
                                        <ItemRow key={item.id} item={item} chipWidth={chipWidth}/>
                                    ))}
                                </Stack>
                            ) : (
                                <Typography variant="body2">No credits available.</Typography>
                            )}
                        </Box>

                        {benefitDisplayItems.length > 0 && (
                            <Box>
                                <Typography variant="h6" component="div" gutterBottom sx={{
                                    display: 'inline-block',
                                    borderBottom: '2px solid',
                                    borderColor: 'primary.main'
                                }}>
                                    Benefits
                                </Typography>
                                <Stack>
                                    {benefitDisplayItems.map((item) => (
                                        <ItemRow key={item.id} item={item} chipWidth={chipWidth}/>
                                    ))}
                                </Stack>
                            </Box>
                        )}

                        {customDisplayItems.length > 0 && (
                            <Box>
                                <Typography variant="h6" component="div" gutterBottom sx={{
                                    display: 'inline-block',
                                    borderBottom: '2px solid',
                                    borderColor: 'primary.main'
                                }}>
                                    Additional
                                </Typography>
                                <Stack>
                                    {customDisplayItems.map((item) => (
                                        <ItemRow key={item.id} item={item} chipWidth={chipWidth}/>
                                    ))}
                                </Stack>
                            </Box>
                        )}
                    </Stack>
                </Box>
            </CardContent>

            {/* 估值编辑 */}
            <ValuationEditComponent
                open={editOpen}
                card={card}
                displayCredits={sortedCredits}
                displayBenefits={sortedBenefits} // 新增：传入 benefits
                initialValuation={userValuation}
                onCustomValuationClear={() => setUserValuation(undefined)}
                onClose={() => setEditOpen(false)}
                onSave={(valuation) => handleSave({cardValuation: valuation})}
            />
            {/* 单个 credit 编辑弹窗 */}
            <ValuationEditComponent
                open={!!editingCreditId}
                card={card}
                initialValuation={userValuation}
                onCustomValuationClear={() => setUserValuation(undefined)}
                onClose={() => setEditingCreditId(null)}
                onSave={(valuation) => handleSave({cardValuation: valuation})}
                singleCreditIdToEdit={editingCreditId ?? undefined}
            />
            {/* 单个 benefit 编辑弹窗 */}
            <ValuationEditComponent
                open={!!editingBenefitId}
                card={card}
                initialValuation={userValuation}
                onCustomValuationClear={() => setUserValuation(undefined)}
                onClose={() => setEditingBenefitId(null)}
                onSave={(valuation) => handleSave({cardValuation: valuation})}
                singleBenefitIdToEdit={editingBenefitId ?? undefined}
            />
            {/* 单个 custom adjustment 编辑对话框 */}
            <ValuationEditComponent
                open={!!editingCustomAdjustmentId}
                card={card}
                displayCredits={sortedCredits}
                initialValuation={userValuation}
                onCustomValuationClear={() => setUserValuation(undefined)}
                onClose={() => setEditingCustomAdjustmentId(null)}
                onSave={(valuation) => handleSave({cardValuation: valuation})}
                singleCustomAdjustmentIdToEdit={editingCustomAdjustmentId ?? undefined}
            />

            {/* 计算返现弹窗 */}
            <CashBackEditor
                open={cashbackOpen}
                onClose={() => setCashbackOpen(false)}
                card={card}
                initialCardValuation={userValuation}
                initialPointSystemValuations={pointSystemValuations}
                onSave={handleSave}
                netWorthCents={roi}
            />

            {/* 分享估值弹窗 */}
            <ShareValuation
                open={shareOpen}
                onClose={() => setShareOpen(false)}
                card={card}
                valuation={userValuation}
            />
        </Card>
    );
};

export default CreditCardComponent;
