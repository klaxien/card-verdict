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
import {cardverdict, userprofile} from '~/generated/bundle';

type CustomAdjustment = userprofile.v1.ICustomAdjustment;
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
    // 上报当前组件内是否存在错误，以便外层禁用保存
    onValidityChange?: (hasError: boolean) => void;
};

type AmountFieldState = {
    input: string;        // 原始显示值（未必通过校验）
    error?: string | null;
};

export const CustomAdjustmentsEditor: React.FC<CustomAdjustmentsEditorProps> = ({
                                                                                    customAdjustments,
                                                                                    onAdd,
                                                                                    onUpdate,
                                                                                    onDelete,
                                                                                    sessionSingleCustomAdjustmentId,
                                                                                    onValidityChange,
                                                                                }) => {
    const adjustmentsToRender = sessionSingleCustomAdjustmentId
        ? customAdjustments.filter(item => item.customAdjustmentId === sessionSingleCustomAdjustmentId)
        : customAdjustments;

    // 本地“显示值”与错误态，按 id 存
    const [amountFieldById, setAmountFieldById] = React.useState<Record<string, AmountFieldState>>({});

    // 同步初始化/外部变更
    React.useEffect(() => {
        setAmountFieldById((previousMap) => {
            const nextMap: Record<string, AmountFieldState> = {};
            for (const item of adjustmentsToRender) {
                const id = item.customAdjustmentId ?? '';
                const dollars = (item.valueCents ?? 0) / 100;
                const initialDisplay = Number.isFinite(dollars) ? dollars.toFixed(2) : '0.00';
                // 已存在则保留正在编辑的输入；否则以当前 cents 的格式化值作为初始显示
                nextMap[id] = previousMap[id] ?? {input: initialDisplay, error: null};
            }
            return nextMap;
        });
    }, [adjustmentsToRender]);

    // 上报是否有错误
    React.useEffect(() => {
        const hasError = Object.values(amountFieldById).some(state => !!state.error);
        onValidityChange?.(hasError);
    }, [amountFieldById, onValidityChange]);

    const handleAmountChange = (id: string, rawInput: string, currentItem: CustomAdjustment) => {
        setAmountFieldById((previousMap) => {
            const validationResult = validateSignedDollars(rawInput);
            const nextFieldState: AmountFieldState = {
                input: rawInput,                          // 始终回显用户输入
                error: validationResult.ok ? null : (validationResult.msg ?? '输入无效'),
            };

            // 输入有效则更新分值；无效则保持父级不变，避免跳动
            if (validationResult.ok && validationResult.cleaned != null) {
                const numeric = Number(validationResult.cleaned);
                onUpdate(id, {valueCents: Math.round(numeric * 100)});
            } else {
                onUpdate(id, {valueCents: currentItem.valueCents});
            }

            return {...previousMap, [id]: nextFieldState};
        });
    };

    const handleAmountBlur = (id: string) => {
        setAmountFieldById((previousMap) => {
            const currentField = previousMap[id];
            if (!currentField) return previousMap;
            const validationResult = validateSignedDollars(currentField.input);
            if (validationResult.ok && validationResult.cleaned != null) {
                const numeric = Number(validationResult.cleaned);
                // 失焦时规范化为两位小数
                return {...previousMap, [id]: {input: numeric.toFixed(2), error: null}};
            }
            // 保留错误与原样显示
            return previousMap;
        });
    };

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
                        const id = item.customAdjustmentId ?? '';
                        const fieldState = amountFieldById[id];

                        // @ts-ignore wrong identification?
                        const frequency = item.frequency && item.frequency !== CreditFrequency.FREQUENCY_UNSPECIFIED
                            ? item.frequency
                            : CreditFrequency.ANNUAL;

                        const fallbackDisplay = Number.isFinite((item.valueCents ?? 0) / 100)
                            ? ((item.valueCents ?? 0) / 100).toFixed(2)
                            : '0.00';

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
                                            value={fieldState?.input ?? fallbackDisplay}
                                            onChange={(e) => handleAmountChange(id, e.target.value, item)}
                                            onBlur={() => handleAmountBlur(id)}
                                            error={!!fieldState?.error}
                                            helperText={fieldState?.error ?? ''}
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
