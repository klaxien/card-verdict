import React, {useMemo} from 'react';
import {
    Box,
    Divider,
    Paper,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Typography,
    useTheme
} from '@mui/material';
import {
    CartesianGrid,
    Legend,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    type TooltipProps,
    XAxis,
    YAxis
} from 'recharts';
import type {NameType, ValueType} from "recharts/types/component/DefaultTooltipContent";
import {cardverdict} from "~/generated/bundle";

const {CreditFrequency} = cardverdict.v1;

// --- Props 定义 ---
interface BreakevenAnalysisTabProps {
    // 从 FormWatcher 传入的消费数据
    spendings: Array<{
        amountInput: string;
        frequency: cardverdict.v1.CreditFrequency;
        _description: string;
    }>;
    // 从主组件计算得出的值
    totalAnnualSpend: number;
    spendReturnRate: number;
    netWorthCents: number;
}

// --- 辅助函数 (保持组件自包含) ---
const periodsInYearFor = (frequency?: cardverdict.v1.CreditFrequency): number => {
    switch (frequency) {
        case CreditFrequency.ANNUAL:
            return 1;
        case CreditFrequency.SEMI_ANNUAL:
            return 2;
        case CreditFrequency.QUARTERLY:
            return 4;
        case CreditFrequency.MONTHLY:
            return 12;
        default:
            return 1;
    }
};

// --- 自定义图表 Tooltip ---
const CustomTooltip = ({active, payload, label}: TooltipProps<ValueType, NameType>) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <Paper elevation={3} sx={{p: 2}}>
                <Typography variant="body2" fontWeight="bold" gutterBottom>
                    总消费: ${label.toFixed(0)}
                </Typography>
                <Typography variant="body2" color="primary" gutterBottom>
                    总返现率: {data.returnRate.toFixed(2)}%
                </Typography>
                <Divider sx={{my: 1}}/>
                <Typography variant="caption" display="block">消费构成:</Typography>
                <Stack spacing={0.5}>
                    {data.breakdown.map((item: any, index: number) => (
                        <Typography variant="caption" key={index}>
                            {item.description}: ${item.amount.toFixed(0)}
                        </Typography>
                    ))}
                </Stack>
            </Paper>
        );
    }
    return null;
};


const BreakevenAnalysisTab: React.FC<BreakevenAnalysisTabProps> = ({
                                                                       spendings,
                                                                       totalAnnualSpend,
                                                                       spendReturnRate,
                                                                       netWorthCents
                                                                   }) => {
    const theme = useTheme();

    const analysisData = useMemo(() => {
        const activeSpendings = (spendings ?? []).filter(s => s && parseFloat(s.amountInput) > 0);
        const hasSpending = activeSpendings.length > 0 && totalAnnualSpend > 0;
        if (!hasSpending) {
            return {show: false, tableRows: [], chartData: [], tableHeaders: []};
        }

        const spendRate = spendReturnRate;
        const netWorth = netWorthCents / 100;

        const tableTargets = [0, 1, 2, 3, 4, 5];
        const activeSpendingProportions = activeSpendings.map(s => {
            const annualAmount = (parseFloat(s.amountInput) || 0) * periodsInYearFor(s.frequency);
            return {
                description: s._description,
                proportion: annualAmount / totalAnnualSpend,
            };
        });
        const tableHeaders = activeSpendingProportions.map(p => p.description);

        const tableRows = tableTargets.map(targetPercent => {
            const denominator = (spendRate - targetPercent) / 100;
            let requiredTotalSpend: number | null;
            if (Math.abs(denominator) < 1e-9) {
                requiredTotalSpend = null;
            } else {
                requiredTotalSpend = -netWorth / denominator;
            }
            const breakdown = activeSpendingProportions.map(({proportion}) =>
                requiredTotalSpend !== null && requiredTotalSpend >= 0 ? requiredTotalSpend * proportion : null
            );
            return {targetPercent, total: requiredTotalSpend, breakdown};
        });

        const chartData = [];
        const startSpend = tableRows[0]?.total ?? totalAnnualSpend;
        if (startSpend > 0) {
            const maxSpend = Math.max(startSpend * 5, totalAnnualSpend * 5, 20000);
            const steps = 20;
            for (let i = 0; i <= steps; i++) {
                const currentSpend = startSpend + (maxSpend - startSpend) * (i / steps);
                if (currentSpend <= 0) continue;
                const rate = (spendRate + (netWorth * 100) / currentSpend);
                const breakdown = activeSpendingProportions.map(({description, proportion}) => ({
                    description: description.split(' ')[0],
                    amount: currentSpend * proportion,
                }));
                chartData.push({spend: currentSpend, returnRate: rate, breakdown: breakdown});
            }
        }

        return {show: true, tableHeaders, tableRows, chartData};
    }, [spendings, totalAnnualSpend, spendReturnRate, netWorthCents]);

    if (!analysisData.show) {
        return (
            <Typography variant="body2" display="block" textAlign="center" color="text.secondary" sx={{py: 4}}>
                在“消费规划”标签页中输入计划消费以查看分析
            </Typography>
        );
    }

    return (
        <Stack spacing={3}>
            <TableContainer sx={{maxHeight: 220}}>
                <Table size="small" stickyHeader>
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{fontWeight: 'bold'}}>目标返现率</TableCell>
                            <TableCell align="right" sx={{fontWeight: 'bold'}}>所需总消费</TableCell>
                            {analysisData.tableHeaders.map(header => (
                                <TableCell align="right" key={header}
                                           sx={{fontWeight: 'bold'}}>{header.split(' ')[0]}</TableCell>
                            ))}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {analysisData.tableRows.map((row) => (
                            <TableRow key={row.targetPercent}>
                                <TableCell component="th" scope="row">{row.targetPercent}%</TableCell>
                                <TableCell
                                    align="right">{row.total !== null && row.total >= 0 ? `$${row.total.toFixed(0)}` : '无法达到'}</TableCell>
                                {row.breakdown.map((spend, index) => (
                                    <TableCell align="right"
                                               key={index}>{spend !== null && spend >= 0 ? `$${spend.toFixed(0)}` : '--'}</TableCell>
                                ))}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>

            <Box sx={{height: 300, width: '100%'}}>
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={analysisData.chartData} margin={{top: 5, right: 20, left: -10, bottom: 5}}>
                        <CartesianGrid strokeDasharray="3 3"/>
                        <XAxis dataKey="spend" type="number" domain={['dataMin', 'dataMax']}
                               tickFormatter={(tick) => `$${Math.round(tick / 1000)}k`} name="总消费"/>
                        <YAxis domain={[0, 'dataMax + 1']} tickFormatter={(tick) => `${tick.toFixed(1)}%`}
                               name="总返现率"/>
                        <Tooltip content={<CustomTooltip/>}/>
                        <Legend formatter={() => "总返现率"}/>
                        <Line type="monotone" dataKey="returnRate" stroke={theme.palette.primary.main} strokeWidth={2}
                              dot={false}/>
                    </LineChart>
                </ResponsiveContainer>
            </Box>
        </Stack>
    );
};

export default BreakevenAnalysisTab;
