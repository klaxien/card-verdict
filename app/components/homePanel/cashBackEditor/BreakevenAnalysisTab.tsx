import React, {useEffect, useMemo} from 'react';
import {
    Alert,
    Box,
    Divider,
    FormControl,
    FormControlLabel,
    Grid,
    MenuItem,
    Paper,
    Select,
    Stack,
    Switch,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Typography,
    useMediaQuery,
    useTheme
} from '@mui/material';
import {CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis} from 'recharts';
// --- MODIFICATION: Import new proto definitions ---
import {cardverdict, userprofile} from "~/generated/bundle";
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined';
import FunctionsIcon from '@mui/icons-material/Functions';

// --- MODIFICATION: Use enums from generated code ---
const {CreditFrequency} = cardverdict.v1;
const {SpendingCalculationMode} = userprofile.v1;

// --- MODIFICATION: Props are updated to receive state and handlers from parent ---
interface BreakevenAnalysisTabProps {
    spendings: Array<{
        id: string;
        description: string;
        multiplier: number;
        amountInput: string;
        frequency: cardverdict.v1.CreditFrequency;
    }>;
    cppInput: string;
    totalAnnualSpend: number;
    spendReturnRate: number;
    netWorthCents: number;
    includeNetWorth: boolean;
    onIncludeNetWorthChange: (include: boolean) => void;
    calculationModes: Record<string, userprofile.v1.SpendingCalculationMode>;
    onCalculationModeChange: React.Dispatch<React.SetStateAction<Record<string, userprofile.v1.SpendingCalculationMode>>>;
}

// --- MODIFICATION: Removed `type CalculationMode = 'linear' | 'fixed';` ---

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

interface CustomTooltipProps {
    active?: boolean;
    payload?: Array<{ payload: { returnRate: number; breakdown: Array<{ description: string; amount: number }>; }; }>;
    label?: string | number;
}

const CustomTooltip = ({active, payload, label}: CustomTooltipProps) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <Paper elevation={3} sx={{p: 2, minWidth: 220}}>
                <Typography variant="body2" fontWeight="bold" gutterBottom>总消费:
                    ${Number(label).toFixed(0)}</Typography>
                <Typography variant="body2" color="primary"
                            gutterBottom>总返现率: {data.returnRate.toFixed(2)}%</Typography>
                <Divider sx={{my: 1}}/>
                <Typography variant="caption" display="block" color="text.secondary">消费构成:</Typography>
                <Stack spacing={0.5} mt={0.5}>
                    {data.breakdown.map((item: any, index: number) => (
                        <Grid container key={index} justifyContent="space-between" spacing={1}>
                            <Grid size={"grow"}>
                                <Typography variant="caption" noWrap
                                            title={item.description}>{item.description}:</Typography>
                            </Grid>
                            <Grid>
                                <Typography variant="caption" fontWeight={500}
                                            sx={{pl: 1}}>${item.amount.toFixed(0)}</Typography>
                            </Grid>
                        </Grid>
                    ))}
                </Stack>
            </Paper>
        );
    }
    return null;
};

const BreakevenAnalysisTab: React.FC<BreakevenAnalysisTabProps> = ({
                                                                       spendings,
                                                                       cppInput,
                                                                       totalAnnualSpend,
                                                                       spendReturnRate,
                                                                       netWorthCents,
                                                                       includeNetWorth,
                                                                       onIncludeNetWorthChange,
                                                                       calculationModes,
                                                                       onCalculationModeChange
                                                                   }) => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    // --- MODIFICATION: Internal state is removed, now managed by parent ---

    const activeSpendings = useMemo(() =>
            (spendings ?? []).filter(s => s && parseFloat(s.amountInput) > 0),
        [spendings]);

    // --- MODIFICATION: This effect now ensures any new spending item gets a default mode in the PARENT state ---
    useEffect(() => {
        const newModes = {...calculationModes};
        let hasChanged = false;
        activeSpendings.forEach(s => {
            if (!(s.id in newModes)) {
                newModes[s.id] = SpendingCalculationMode.LINEAR; // Default to LINEAR
                hasChanged = true;
            }
        });
        if (hasChanged) {
            onCalculationModeChange(newModes);
        }
    }, [activeSpendings.map(s => s.id).join(','), calculationModes, onCalculationModeChange]);

    // --- MODIFICATION: Mode change handler now calls the parent's state setter ---
    const handleModeChange = (id: string, mode: userprofile.v1.SpendingCalculationMode) => {
        onCalculationModeChange(prev => ({...prev, [id]: mode}));
    };

    const analysisData = useMemo(() => {
        const cpp = parseFloat(cppInput) || 0;
        const effectiveNetWorth = includeNetWorth ? netWorthCents / 100 : 0;

        if (activeSpendings.length === 0) return {
            show: false, tableRows: [], chartData: [], tableHeaders: [], isConstantRate: false, constantRate: 0
        };

        // --- MODIFICATION: Use proto enum for comparison ---
        const fixedSpendItems = activeSpendings.filter(s => calculationModes[s.id] === SpendingCalculationMode.FIXED);
        const linearSpendItems = activeSpendings.filter(s => calculationModes[s.id] !== SpendingCalculationMode.FIXED);

        const totalFixedSpend = fixedSpendItems.reduce((sum, s) => sum + (parseFloat(s.amountInput) || 0) * periodsInYearFor(s.frequency), 0);
        const isPurelyLinearWithNoFixedCost = effectiveNetWorth === 0 && totalFixedSpend === 0;

        const baseLinearSpend = linearSpendItems.reduce((sum, s) => sum + (parseFloat(s.amountInput) || 0) * periodsInYearFor(s.frequency), 0);
        const baseLinearRewards = linearSpendItems.reduce((sum, s) => sum + ((parseFloat(s.amountInput) || 0) * periodsInYearFor(s.frequency) * s.multiplier * cpp) / 100, 0);
        const effectiveLinearSpendRate = baseLinearSpend > 0 ? baseLinearRewards / baseLinearSpend : 0;

        if (isPurelyLinearWithNoFixedCost) {
            return {
                show: true, isConstantRate: true, constantRate: effectiveLinearSpendRate * 100,
                tableRows: [], chartData: [], tableHeaders: []
            };
        }

        const totalFixedRewards = fixedSpendItems.reduce((sum, s) => sum + ((parseFloat(s.amountInput) || 0) * periodsInYearFor(s.frequency) * s.multiplier * cpp) / 100, 0);

        const currentEffectiveReturnRate = totalAnnualSpend > 0 ? (spendReturnRate + (effectiveNetWorth * 100) / totalAnnualSpend) : (effectiveNetWorth > 0 ? Infinity : 0);
        let tableTargets: number[];
        if (currentEffectiveReturnRate > 5) {
            const startRate = Math.ceil(currentEffectiveReturnRate);
            tableTargets = Array.from({length: 5}, (_, i) => startRate + i);
        } else {
            tableTargets = [0, 1, 2, 3, 4, 5];
        }

        const tableHeaders = activeSpendings.map(s => s.description);
        const tableRows = tableTargets.map(targetPercent => {
            const targetRate = targetPercent / 100;
            const numerator = totalFixedRewards + effectiveNetWorth - targetRate * totalFixedSpend;
            const denominator = targetRate - effectiveLinearSpendRate;
            let requiredLinearSpend = (Math.abs(denominator) < 1e-9) ? (Math.abs(numerator) > 1e-9 ? null : 0) : (numerator / denominator);
            const requiredTotalSpend = (requiredLinearSpend !== null && requiredLinearSpend >= 0) ? requiredLinearSpend + totalFixedSpend : null;
            const breakdown = activeSpendings.map(s => {
                if (requiredLinearSpend === null || requiredLinearSpend < 0) return null;
                // --- MODIFICATION: Use proto enum for comparison ---
                if (calculationModes[s.id] === SpendingCalculationMode.FIXED) return (parseFloat(s.amountInput) || 0) * periodsInYearFor(s.frequency);
                const proportion = baseLinearSpend > 0 ? ((parseFloat(s.amountInput) || 0) * periodsInYearFor(s.frequency)) / baseLinearSpend : 0;
                return requiredLinearSpend * proportion;
            });
            return {targetPercent, total: requiredTotalSpend, breakdown};
        });

        const chartData = [];
        if (baseLinearSpend > 0) {
            const breakevenTotalSpend = tableRows[0]?.total;
            const startSpend = (breakevenTotalSpend !== null && breakevenTotalSpend >= 0) ? breakevenTotalSpend : totalAnnualSpend;
            if (startSpend > 0) {
                const maxSpend = Math.max(startSpend * 3, totalAnnualSpend * 3, 20000);
                const steps = 20;
                for (let i = 0; i <= steps; i++) {
                    const currentTotalSpend = startSpend + (maxSpend - startSpend) * (i / steps);
                    if (currentTotalSpend < totalFixedSpend) continue;
                    const currentLinearSpend = currentTotalSpend - totalFixedSpend;
                    const totalRewards = (currentLinearSpend * effectiveLinearSpendRate) + totalFixedRewards;
                    const rate = (totalRewards + effectiveNetWorth) / currentTotalSpend * 100;
                    const breakdown = activeSpendings.map(s => ({
                        description: s.description,
                        amount: calculationModes[s.id] === SpendingCalculationMode.FIXED ? (parseFloat(s.amountInput) || 0) * periodsInYearFor(s.frequency) : currentLinearSpend * (baseLinearSpend > 0 ? ((parseFloat(s.amountInput) || 0) * periodsInYearFor(s.frequency)) / baseLinearSpend : 0),
                    }));
                    chartData.push({spend: currentTotalSpend, returnRate: rate, breakdown: breakdown});
                }
            }
        }
        return {show: true, tableRows, chartData, tableHeaders, isConstantRate: false, constantRate: 0};
    }, [activeSpendings, calculationModes, cppInput, netWorthCents, totalAnnualSpend, includeNetWorth, spendReturnRate]);

    if (!analysisData.show) {
        return <Typography variant="body2" display="block" textAlign="center" color="text.secondary"
                           sx={{py: 4}}>在“消费规划”标签页中输入计划消费以查看分析</Typography>;
    }

    const AnalysisChart = () => (
        <Paper elevation={2} sx={{p: 2, height: '100%'}}>
            <Typography variant="h6" fontWeight="bold" gutterBottom>回报率曲线</Typography>
            <Box sx={{height: 300}}>
                {analysisData.chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={analysisData.chartData} margin={{top: 10, right: 10, left: 10, bottom: 10}}>
                            <CartesianGrid strokeDasharray="3 3"/>
                            <XAxis dataKey="spend" type="number" domain={['dataMin', 'dataMax']}
                                   tickFormatter={(tick) => `$${Math.round(tick / 1000)}k`} name="总消费"/>
                            <YAxis domain={['auto', 'auto']} tickFormatter={(tick) => `${tick.toFixed(1)}%`}
                                   name="总返现率"/>
                            <Tooltip content={<CustomTooltip/>}/>
                            <Legend formatter={() => "总返现率"}/>
                            <Line type="monotone" dataKey="returnRate" stroke={theme.palette.primary.main}
                                  strokeWidth={2} dot={false}/>
                        </LineChart>
                    </ResponsiveContainer>
                ) : <Typography variant="body2" color="text.secondary"
                                textAlign="center">无法生成图表（例如所有消费都设为固定）。</Typography>}
            </Box>
        </Paper>
    );

    const AnalysisTable = () => (
        <Paper elevation={2} sx={{p: 2, height: '100%'}}>
            <Typography variant="h6" fontWeight="bold" gutterBottom>盈亏平衡点</Typography>
            <TableContainer>
                <Table size="small">
                    <TableHead sx={{backgroundColor: theme.palette.action.hover}}>
                        <TableRow>
                            <TableCell sx={{fontWeight: 'bold'}}>目标返现率</TableCell>
                            <TableCell align="right" sx={{fontWeight: 'bold'}}>所需总消费</TableCell>
                            {analysisData.tableHeaders.map(header => <TableCell align="right" key={header} sx={{
                                fontWeight: 'bold',
                                whiteSpace: 'nowrap'
                            }}>{header.split(' ')[0]}</TableCell>)}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {analysisData.tableRows.map((row) => (
                            <TableRow key={row.targetPercent}>
                                <TableCell component="th" scope="row">{row.targetPercent}%</TableCell>
                                <TableCell
                                    align="right">{row.total !== null && row.total >= 0 ? `$${row.total.toFixed(0)}` : '无法达到'}</TableCell>
                                {row.breakdown.map((spend, index) => <TableCell align="right"
                                                                                key={index}>{spend !== null && spend >= 0 ? `$${spend.toFixed(0)}` : '--'}</TableCell>)}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </Paper>
    );

    const AlgorithmControls = () => (
        <Paper elevation={2} sx={{p: 2}}>
            <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                <TuneOutlinedIcon color="action"/>
                <Typography variant="h6" fontWeight="bold">算法调整</Typography>
            </Stack>
            <FormControlLabel
                // Use prop value and handler ---
                control={<Switch checked={includeNetWorth}
                                 onChange={(e) => onIncludeNetWorthChange(e.target.checked)}/>}
                label={<Typography variant="body2">计算时考虑等效年费</Typography>}
                sx={{mb: 1}}
            />
            <Divider sx={{mb: 2}}/>
            <Stack spacing={2}>
                {activeSpendings.map(spending => {
                    const annualAmount = (parseFloat(spending.amountInput) || 0) * periodsInYearFor(spending.frequency);
                    return (
                        <Grid container key={spending.id} alignItems="center" spacing={1}>
                            <Grid size={{xs: 7, sm: 8}}>
                                <Typography variant="body2" noWrap
                                            title={spending.description}>{spending.description}</Typography>
                            </Grid>
                            <Grid size={{xs: 5, sm: 4}}>
                                <FormControl fullWidth size="small">
                                    {/*  Use prop value and handler with proto enum --- */}
                                    <Select
                                        value={calculationModes[spending.id] || SpendingCalculationMode.LINEAR}
                                        onChange={(e) => handleModeChange(spending.id, e.target.value as userprofile.v1.SpendingCalculationMode)}>
                                        <MenuItem value={SpendingCalculationMode.LINEAR}>线性增加</MenuItem>
                                        <MenuItem value={SpendingCalculationMode.FIXED}>固定每年:
                                            ${annualAmount.toFixed(0)}</MenuItem>
                                    </Select>
                                </FormControl>
                            </Grid>
                        </Grid>
                    );
                })}
            </Stack>
        </Paper>
    );

    return (
        <Stack spacing={3} sx={{mt: 2}}>
            <Alert severity="info" icon={<InfoOutlinedIcon fontSize="inherit"/>}>
                算法说明：根据在“消费规划”页的输入进行分析。可以在下方调整每个消费类别的计算方式（固定值或线性增减）来模拟不同消费场景。
            </Alert>

            {analysisData.isConstantRate ? (
                <Alert severity="warning" icon={<FunctionsIcon/>}>
                    <Typography fontWeight="bold">回报率固定</Typography>
                    <Typography variant="body2">
                        当关闭年费计算且所有消费都按比例增减时，返现率是一个固定值，恒为 <b>{analysisData.constantRate.toFixed(2)}%</b>，与消费金额无关。
                    </Typography>
                    <Typography variant="caption" display="block" mt={1}>
                        请将某项消费设为“固定”或开启年费计算以进行盈亏分析。
                    </Typography>
                </Alert>
            ) : isMobile ? (
                <Stack spacing={3}>
                    <AnalysisChart/>
                    <AnalysisTable/>
                </Stack>
            ) : (
                <Grid container spacing={3}>
                    <Grid size={{xs: 12, sm: 7}}><AnalysisChart/></Grid>
                    <Grid size={{xs: 12, sm: 5}}><AnalysisTable/></Grid>
                </Grid>
            )}

            <AlgorithmControls/>
        </Stack>
    );
};

export default BreakevenAnalysisTab;
