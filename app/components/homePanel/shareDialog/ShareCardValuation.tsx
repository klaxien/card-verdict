// dialogs/ShareValuation.tsx
import React, {useEffect, useMemo, useState} from 'react';
import {
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Snackbar,
    Stack,
    TextField,
    Typography
} from '@mui/material';
import {cardverdict, userprofile} from '~/generated/bundle';
import {
    calcRawAnnualCents,
    calculateNetWorth,
    getDisplayEffectiveCents,
    getDisplayEffectiveCentsForBenefit,
    periodsInYearFor
} from "~/utils/cardCalculations";
import {getBenefitDisplayDetails, shouldDisplayBenefit} from "~/components/homePanel/utils/creditCardDisplayUtils";

type ShareValuationProps = {
    open: boolean;
    onClose: () => void;
    card: cardverdict.v1.ICreditCard;
    valuation?: userprofile.v1.IUserCardValuation;
};

// 辅助函数：根据格式生成分享文案
const generateShareText = (
    card: cardverdict.v1.ICreditCard,
    valuation: userprofile.v1.IUserCardValuation | undefined,
    format: 'plain' | 'markdown'
): string => {
    const cardName = card.name ?? '这张卡';
    const annualFee = (card.annualFeeCents ?? 0) / 100;
    const netWorth = calculateNetWorth(card, valuation) / 100;

    // --- 纯文本格式 ---
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
                lines.push(`  • ${description}，年价值$${rawValue.toFixed(0)}，我的估值$${myValue.toFixed(0)}`);
            });
            lines.push('');
        }

        const valuedBenefits = (card.otherBenefits ?? []).filter(b => getDisplayEffectiveCentsForBenefit(b, valuation) >= 0);
        if (valuedBenefits.length > 0) {
            lines.push('Benefits:');
            valuedBenefits.forEach(benefit => {
                const description = getBenefitDisplayDetails(benefit);
                const myValue = getDisplayEffectiveCentsForBenefit(benefit, valuation) / 100;
                lines.push(`  • ${description}，我的估值$${myValue.toFixed(0)}`);
            });
            lines.push('');
        }

        const adjustments = valuation?.customAdjustments?.filter(adj => adj.valueCents);
        if (adjustments && adjustments.length > 0) {
            lines.push('自定义:');
            adjustments.forEach(adj => {
                const description = adj.description ?? '自定义项';
                const annualValue = ((adj.valueCents ?? 0) * periodsInYearFor(adj.frequency)) / 100;
                lines.push(`  • ${description}，我的估值$${annualValue.toFixed(0)}`);
            });
            lines.push('');
        }
        return lines.join('\n').trim();
    }

    // --- Markdown 表格格式 ---
    const summary = `我对「${cardName}」的估值：\n此卡年费**$${annualFee.toFixed(0)}**，等效年费（净值）**$${netWorth.toFixed(0)}**\n`;
    const table: string[] = [];
    table.push(`| 类型 | 描述 | 纸面价值 | 估值 |`);
    table.push(`|:---|:---|:---|:---|`);

    const sanitize = (text: string | null | undefined) => (text ?? 'N/A').replace(/\|/g, ' ');

    (card.credits ?? []).forEach(credit => {
        const desc = sanitize(credit.details);
        const raw = `$${(calcRawAnnualCents(credit) / 100).toFixed(0)}`;
        const val = `$${(getDisplayEffectiveCents(credit, valuation) / 100).toFixed(0)}`;
        table.push(`| Credit | ${desc} | ${raw} | ${val} |`);
    });

    (card.otherBenefits ?? []).forEach(benefit => {
        if (!shouldDisplayBenefit(benefit)) return;

        const myValue = getDisplayEffectiveCentsForBenefit(benefit, valuation);
        const desc = sanitize(getBenefitDisplayDetails(benefit));
        const val = `$${(myValue / 100).toFixed(0)}`;
        table.push(`| Benefit | ${desc} | N/A | ${val} |`);
    });

    (valuation?.customAdjustments ?? []).forEach(adj => {
        const desc = sanitize(adj.description);
        const val = `$${(((adj.valueCents ?? 0) * periodsInYearFor(adj.frequency)) / 100).toFixed(0)}`;
        table.push(`| 自定义 | ${desc} | N/A | ${val} |`);
    });

    return summary + '\n' + table.join('\n');
};

const ShareValuation: React.FC<ShareValuationProps> = ({open, onClose, card, valuation}) => {
    const [snackbarOpen, setSnackbarOpen] = useState(false);

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
        setPlainText(initialPlainText);
        setMarkdownText(initialMarkdownText);
    }, [initialPlainText, initialMarkdownText]);

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

    return (
        <>
            <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
                <DialogTitle>分享估值</DialogTitle>
                <DialogContent dividers>
                    <Stack spacing={3}>
                        <Box>
                            <Typography variant="subtitle1" gutterBottom>分享为纯文本</Typography>
                            <TextField
                                value={plainText}
                                onChange={(e) => setPlainText(e.target.value)}
                                fullWidth
                                multiline
                                rows={5} // 固定显示5行
                                variant="outlined"
                            />
                            <Box textAlign="right" mt={1}>
                                <Button onClick={() => handleCopy(plainText)}>复制</Button>
                            </Box>
                        </Box>

                        <Box>
                            <Typography variant="subtitle1" gutterBottom>分享为Markdown</Typography>
                            <TextField
                                value={markdownText}
                                onChange={(e) => setMarkdownText(e.target.value)}
                                fullWidth
                                multiline
                                rows={5} // 固定显示5行
                                variant="outlined"
                            />
                            <Box textAlign="right" mt={1}>
                                <Button onClick={() => handleCopy(markdownText)}>复制</Button>
                            </Box>
                        </Box>
                    </Stack>
                </DialogContent>
                <DialogActions>
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