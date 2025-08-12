// dialogs/ShareValuation.tsx
import React, {useEffect, useMemo, useState} from 'react';
import {
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    InputAdornment,
    Snackbar,
    Tab,
    Tabs,
    TextField,
    Tooltip,
    useMediaQuery,
    useTheme
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import {cardverdict, userprofile} from '~/generated/bundle';
import {
    calcRawAnnualCents,
    calculateNetWorth,
    getDisplayEffectiveCents,
    getDisplayEffectiveCentsForBenefit,
    periodsInYearFor
} from "~/utils/cardCalculations";
import {getBenefitDisplayDetails, shouldDisplayBenefit} from "~/components/homePanel/utils/creditCardDisplayUtils";

// --- TabPanel Helper Component ---
// This is a standard helper for creating accessible tab panels with MUI
interface TabPanelProps {
    children?: React.ReactNode;
    index: number;
    value: number;
}

function TabPanel(props: TabPanelProps) {
    const {children, value, index, ...other} = props;
    return (
        <div
            role="tabpanel"
            hidden={value !== index}
            id={`share-tabpanel-${index}`}
            aria-labelledby={`share-tab-${index}`}
            {...other}
        >
            {value === index && (
                <Box sx={{pt: 2}}>
                    {children}
                </Box>
            )}
        </div>
    );
}

// --- Generation Logic (No Changes) ---
const generateShareText = (
    card: cardverdict.v1.ICreditCard,
    valuation: userprofile.v1.IUserCardValuation | undefined,
    format: 'plain' | 'markdown'
): string => {
    const cardName = card.name ?? '这张卡';
    const annualFee = (card.annualFeeCents ?? 0) / 100;
    const netWorth = calculateNetWorth(card, valuation) / 100;

    if (format === 'plain') {
        const lines: string[] = [];
        lines.push(`我对「${cardName}」的估值：`);
        lines.push(`此卡年费$${annualFee.toFixed(0)}，等效年费（净值）$${netWorth.toFixed(0)}`);
        lines.push('');
        if (card.credits && card.credits.length > 0) {
            lines.push('Credits:');
            card.credits.forEach(credit => {
                const description = credit.details ?? 'N/A';
                const rawValue = calcRawAnnualCents(credit) / 100;
                const myValue = getDisplayEffectiveCents(credit, valuation) / 100;
                lines.push(`  •【${description}】年价值$${rawValue.toFixed(0)}，估值$${myValue.toFixed(0)}`);
            });
            lines.push('');
        }
        const valuedBenefits = (card.otherBenefits ?? []).filter(b => getDisplayEffectiveCentsForBenefit(b, valuation) >= 0);
        if (valuedBenefits.length > 0) {
            lines.push('Benefits:');
            valuedBenefits.forEach(benefit => {
                const description = getBenefitDisplayDetails(benefit);
                const myValue = getDisplayEffectiveCentsForBenefit(benefit, valuation) / 100;
                lines.push(`  •【${description}】估值$${myValue.toFixed(0)}`);
            });
            lines.push('');
        }
        const adjustments = valuation?.customAdjustments?.filter(adj => adj.valueCents);
        if (adjustments && adjustments.length > 0) {
            lines.push('User-defined:');
            adjustments.forEach(adj => {
                const description = adj.description ?? '自定义项';
                const annualValue = ((adj.valueCents ?? 0) * periodsInYearFor(adj.frequency)) / 100;
                lines.push(`  •【${description}】我的估值$${annualValue.toFixed(0)}`);
            });
        }
        return lines.join('\n').trim();
    }

    const summary = `我对「${cardName}」的估值：\n此卡年费$${annualFee.toFixed(0)}，等效年费（净值）**$${netWorth.toFixed(0)}**\n`;
    const table: string[] = [];
    table.push(`| 类型 | 描述 | 纸面价值 | 估值 |`);
    table.push(`|:---|:---|:---|:---|`);
    const sanitize = (text: string | null | undefined) => (text ?? 'N/A').replace(/\|/g, ' ');
    (card.credits ?? []).forEach(credit => {
        table.push(`| Credit | ${sanitize(credit.details)} | $${(calcRawAnnualCents(credit) / 100).toFixed(0)} | $${(getDisplayEffectiveCents(credit, valuation) / 100).toFixed(0)} |`);
    });
    (card.otherBenefits ?? []).forEach(benefit => {
        if (!shouldDisplayBenefit(benefit)) return;
        table.push(`| Benefit | ${sanitize(getBenefitDisplayDetails(benefit))} | N/A | $${(getDisplayEffectiveCentsForBenefit(benefit, valuation) / 100).toFixed(0)} |`);
    });
    (valuation?.customAdjustments ?? []).forEach(adj => {
        table.push(`| User-defined | ${sanitize(adj.description)} | N/A | $${(((adj.valueCents ?? 0) * periodsInYearFor(adj.frequency)) / 100).toFixed(0)} |`);
    });
    return summary + '\n' + table.join('\n');
};

// --- Main Component ---
type ShareValuationProps = {
    open: boolean;
    onClose: () => void;
    card: cardverdict.v1.ICreditCard;
    valuation?: userprofile.v1.IUserCardValuation;
};

const ShareValuation: React.FC<ShareValuationProps> = ({open, onClose, card, valuation}) => {
    const [snackbarOpen, setSnackbarOpen] = useState(false);
    const [tabValue, setTabValue] = useState(0);

    const {initialPlainText, initialMarkdownText} = useMemo(() => {
        if (!open) return {initialPlainText: '', initialMarkdownText: ''};
        return {
            initialPlainText: generateShareText(card, valuation, 'plain'),
            initialMarkdownText: generateShareText(card, valuation, 'markdown')
        };
    }, [open, card, valuation]);

    const [plainText, setPlainText] = useState(initialPlainText);
    const [markdownText, setMarkdownText] = useState(initialMarkdownText);

    useEffect(() => {
        if (open) {
            setPlainText(initialPlainText);
            setMarkdownText(initialMarkdownText);
        }
    }, [initialPlainText, initialMarkdownText, open]);

    const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
        setTabValue(newValue);
    };

    const handleCopy = async (text: string) => {
        if (!navigator.clipboard) {
            console.error('Clipboard API not available.');
            return;
        }
        try {
            await navigator.clipboard.writeText(text);
            setSnackbarOpen(true);
        } catch (err) {
            console.error('Failed to copy text: ', err);
        }
    };

    const CopyButtonAdornment = ({textToCopy}: { textToCopy: string }) => (
        <InputAdornment position="end">
            <Tooltip title="复制">
                <IconButton onClick={() => handleCopy(textToCopy)} edge="end">
                    <ContentCopyIcon/>
                </IconButton>
            </Tooltip>
        </InputAdornment>
    );

    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    return (
        <>
            <Dialog open={open} onClose={onClose} fullScreen={isMobile} fullWidth maxWidth="md">
                <DialogTitle>分享您的估值</DialogTitle>
                <DialogContent sx={{p: 2}}>
                    <Box sx={{borderBottom: 1, borderColor: 'divider'}}>
                        <Tabs value={tabValue} onChange={handleTabChange} aria-label="分享格式">
                            <Tab label="纯文本" id="share-tab-0" aria-controls="share-tabpanel-0"/>
                            <Tab label="Markdown" id="share-tab-1" aria-controls="share-tabpanel-1"/>
                        </Tabs>
                    </Box>

                    <TabPanel value={tabValue} index={0}>
                        <TextField
                            value={plainText}
                            onChange={(e) => setPlainText(e.target.value)}
                            fullWidth
                            multiline
                            variant="outlined"
                            InputProps={{
                                endAdornment: <CopyButtonAdornment textToCopy={plainText}/>,
                            }}
                        />
                    </TabPanel>

                    <TabPanel value={tabValue} index={1}>
                        <TextField
                            value={markdownText}
                            onChange={(e) => setMarkdownText(e.target.value)}
                            fullWidth
                            multiline
                            variant="outlined"
                            InputProps={{
                                endAdornment: <CopyButtonAdornment textToCopy={markdownText}/>,
                            }}
                        />
                    </TabPanel>

                </DialogContent>
                <DialogActions sx={{
                    pb: {xs: `max(16px, env(safe-area-inset-bottom))`, sm: 2},
                }}>
                    <Button onClick={onClose}>关闭</Button>
                </DialogActions>
            </Dialog>

            <Snackbar
                open={snackbarOpen}
                autoHideDuration={2000}
                onClose={() => setSnackbarOpen(false)}
                message="已成功复制！"
            />
        </>
    );
};

export default ShareValuation;
