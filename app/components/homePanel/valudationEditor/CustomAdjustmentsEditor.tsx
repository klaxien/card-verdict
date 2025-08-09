import React from 'react';
import {
    Box,
    Button,
    FormControl,
    Grid,
    IconButton,
    InputAdornment,
    InputLabel,
    MenuItem,
    Select,
    Stack,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import {cardverdict, uservaluation} from '~/generated/bundle';

type CustomAdjustment = uservaluation.v1.ICustomAdjustment;
const {CreditFrequency} = cardverdict.v1;

const frequencyOptions: Array<{ label: string; value: cardverdict.v1.CreditFrequency }> = [
    {label: '每年一次', value: cardverdict.v1.CreditFrequency.ANNUAL},
    {label: '每半年一次', value: cardverdict.v1.CreditFrequency.SEMI_ANNUAL},
    {label: '每季度一次', value: cardverdict.v1.CreditFrequency.QUARTERLY},
    {label: '每月一次', value: cardverdict.v1.CreditFrequency.MONTHLY},
];

// 允许正负的美元值（最多两位小数），用于自定义报销
const validateSignedDollars = (raw: string): { ok: boolean; msg?: string; cleaned?: string } => {
    const stripWhitespace = (s: string) => s.replace(/\s+/g, '');
    const stripEdgeNonDigits = (s: string) => s.replace(/^[^\d\-\.]+/, '').replace(/[^\d]+$/, '');
    const cleanEdge = (s: string) => stripEdgeNonDigits(stripWhitespace(s));

    if (raw.trim() === '') return {ok: false, msg: '请输入金额（可为负数）'};
    const cleaned = cleanEdge(raw);
    if (cleaned === '') return {ok: false, msg: '请输入数字'};
    if (!/^-?\d+(\.\d{1,2})?$/.test(cleaned)) return {ok: false, msg: '最多两位小数，可加负号'};
    return {ok: true, cleaned};
};

type CustomAdjustmentsEditorProps = {
    customAdjustments: CustomAdjustment[];
    onAdd: () => void;
    onUpdate: (id: string, patch: Partial<CustomAdjustment>) => void;
    onDelete: (id: string) => void;
    sessionSingleCustomAdjustmentId?: string;
};

export const CustomAdjustmentsEditor: React.FC<CustomAdjustmentsEditorProps> = ({
                                                                                    customAdjustments,
                                                                                    onAdd,
                                                                                    onUpdate,
                                                                                    onDelete,
                                                                                    sessionSingleCustomAdjustmentId,
                                                                                }) => {
    const adjustmentsToRender = sessionSingleCustomAdjustmentId
        ? customAdjustments.filter(item => item.customAdjustmentId === sessionSingleCustomAdjustmentId)
        : customAdjustments;

    return (
        <>
            <Box display="flex" alignItems="center" justifyContent="space-between" sx={{mb: 1}}>
                <Typography variant="h6" component="div">
                    自定义报销
                </Typography>
                {!sessionSingleCustomAdjustmentId &&
                    <Button variant="outlined" onClick={onAdd}>
                        添加自定义报销
                    </Button>
                }
            </Box>

            {adjustmentsToRender.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                    暂无自定义报销。点击“添加自定义报销”新建一条。
                </Typography>
            ) : (
                <Stack spacing={2}>
                    {adjustmentsToRender.map((item) => {
                        const dollars = (item.valueCents ?? 0) / 100;
                        const dollarsStr = Number.isFinite(dollars) ? dollars.toFixed(2) : '0.00';
                        const id = item.customAdjustmentId ?? '';
                        // @ts-ignore wrong identification?
                        const frequency = item.frequency && item.frequency !== CreditFrequency.FREQUENCY_UNSPECIFIED
                            ? item.frequency
                            : CreditFrequency.ANNUAL;
                        return (
                            <Box key={id} sx={{p: 1.5, borderRadius: 1, border: '1px solid', borderColor: 'divider'}}>
                                <Grid container spacing={2} alignItems="center">
                                    <Grid size={{xs: 12, sm: 6}}>
                                        <TextField
                                            fullWidth
                                            label="描述"
                                            value={item.description ?? ''}
                                            onChange={(e) =>
                                                onUpdate(id, {description: e.target.value})
                                            }
                                            size="small"
                                        />
                                    </Grid>

                                    <Grid size={{xs: 12, sm: 3}}>
                                        <FormControl fullWidth size="small">
                                            <InputLabel id={`freq-${id}`}>频率</InputLabel>
                                            <Select
                                                labelId={`freq-${id}`}
                                                label="频率"
                                                value={frequency}
                                                onChange={(e) =>
                                                    onUpdate(
                                                        id,
                                                        {frequency: Number(e.target.value) as cardverdict.v1.CreditFrequency},
                                                    )
                                                }
                                            >
                                                {frequencyOptions.map(opt => (
                                                    <MenuItem key={opt.value} value={opt.value}>
                                                        {opt.label}
                                                    </MenuItem>
                                                ))}
                                            </Select>
                                        </FormControl>
                                    </Grid>

                                    <Grid size={{xs: 12, sm: 3}}>
                                        <TextField
                                            fullWidth
                                            label="金额（美元，可为负）"
                                            value={dollarsStr}
                                            onChange={(e) => {
                                                const v = e.target.value;
                                                const vr = validateSignedDollars(v);
                                                if (!vr.ok || !vr.cleaned) {
                                                    // 直接回显输入，不更新 valueCents，避免跳动
                                                    onUpdate(id, {valueCents: item.valueCents});
                                                } else {
                                                    const num = Number(vr.cleaned);
                                                    onUpdate(id, {valueCents: Math.round(num * 100)});
                                                }
                                            }}
                                            slotProps={{
                                                input: {
                                                    startAdornment: <InputAdornment position="start">$</InputAdornment>,
                                                },
                                            }}
                                            size="small"
                                        />
                                    </Grid>

                                    <Grid size={{xs: 12}}>
                                        <TextField
                                            fullWidth
                                            label="备注（可选）"
                                            value={item.notes ?? ''}
                                            onChange={(e) =>
                                                onUpdate(id, {notes: e.target.value})
                                            }
                                            size="small"
                                            multiline
                                            minRows={1}
                                            maxRows={4}
                                        />
                                    </Grid>

                                    <Grid size={{xs: 12}} display="flex" justifyContent="flex-end">
                                        <Tooltip title="删除此自定义报销">
                                            <IconButton
                                                color="error"
                                                onClick={() => onDelete(id)}
                                                size="small"
                                            >
                                                <DeleteIcon fontSize="small"/>
                                            </IconButton>
                                        </Tooltip>
                                    </Grid>
                                </Grid>
                            </Box>
                        );
                    })}
                </Stack>
            )}
        </>
    );
};
