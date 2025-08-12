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
import {Controller, useFieldArray, useFormContext} from 'react-hook-form';
import type {FormValues} from './ValuationEditComponent';
import {createLengthValidator} from "~/components/common/validators";

type CustomAdjustment = userprofile.v1.ICustomAdjustment;
const { CreditFrequency } = cardverdict.v1;

const frequencyOptions: Array<{ label: string; value: cardverdict.v1.CreditFrequency }> = [
    { label: '每年一次', value: CreditFrequency.ANNUAL },
    { label: '每半年一次', value: CreditFrequency.SEMI_ANNUAL },
    { label: '每季度一次', value: CreditFrequency.QUARTERLY },
    { label: '每月一次', value: CreditFrequency.MONTHLY },
];

// The 'any' type is used here to safely handle various inputs from react-hook-form.
// The logic inside ensures type-safe handling of string, number, null, and undefined.
const validateSignedDollars = (value: any): true | string => {
    if (value === null || value === undefined || String(value).trim() === '') {
        return '请输入金额';
    }
    // Convert the value to its string representation for validation.
    // If it's a number (i.e., in cents), it's converted back to dollars first.
    const s = typeof value === 'number' ? (value / 100).toString() : String(value);
    if (!/^-?\d+(\.\d{1,2})?$/.test(s)) {
        return '最多两位小数，可为负';
    }
    return true;
};

const newCustomAdjustment = (): CustomAdjustment => ({
    customAdjustmentId: (globalThis.crypto?.randomUUID?.() ?? `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`),
    description: '',
    frequency: CreditFrequency.ANNUAL,
    valueCents: 0,
    notes: '',
});

type CustomAdjustmentsEditorProps = {
    sessionSingleCustomAdjustmentId?: string;
};

export const CustomAdjustmentsEditor: React.FC<CustomAdjustmentsEditorProps> = ({
                                                                                    sessionSingleCustomAdjustmentId,
                                                                                }) => {
    const { control } = useFormContext<FormValues>();

    const { fields, append, remove } = useFieldArray({
        control,
        name: 'customAdjustments',
        keyName: 'key',
    });

    const adjustmentsToRender = sessionSingleCustomAdjustmentId
        ? fields.filter(item => item.customAdjustmentId === sessionSingleCustomAdjustmentId)
        : fields;

    return (
        <>
            <Box display="flex" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                <Typography variant="h6" component="div">
                    自定义报销
                </Typography>
                {!sessionSingleCustomAdjustmentId && (
                    <Button variant="outlined" onClick={() => append(newCustomAdjustment())}>
                        添加自定义报销
                    </Button>
                )}
            </Box>

            {adjustmentsToRender.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                    暂无自定义报销。点击“添加自定义报销”新建一条。
                </Typography>
            ) : (
                <Stack spacing={2}>
                    {adjustmentsToRender.map((field, index) => {
                        const originalIndex = fields.findIndex(f => f.key === field.key);

                        return (
                            <Box key={field.key}
                                 sx={{p: 1.5, borderRadius: 1, border: '1px solid', borderColor: 'divider'}}>
                                <Grid container spacing={2} alignItems="flex-start">
                                    <Grid size={{xs: 12, sm: 6}}>
                                        <Controller
                                            name={`customAdjustments.${originalIndex}.description`}
                                            control={control}
                                            rules={{
                                                required: '描述不能为空',
                                                validate: createLengthValidator(30, '描述')
                                            }}
                                            render={({field, fieldState: {error}}) => (
                                                <TextField {...field} fullWidth
                                                           label="描述"
                                                           size="small" autoComplete="off"
                                                           error={!!error} helperText={error?.message ?? ' '}/>
                                            )}
                                        />
                                    </Grid>
                                    <Grid size={{xs: 12, sm: 3}}>
                                        <Controller
                                            name={`customAdjustments.${originalIndex}.frequency`}
                                            control={control}
                                            defaultValue={CreditFrequency.ANNUAL}
                                            render={({field}) => (
                                                <FormControl fullWidth size="small">
                                                    <InputLabel>频率</InputLabel>
                                                    <Select {...field} label="频率">
                                                        {frequencyOptions.map(opt => (
                                                            <MenuItem key={opt.value}
                                                                      value={opt.value}>{opt.label}</MenuItem>
                                                        ))}
                                                    </Select>
                                                </FormControl>
                                            )}
                                        />
                                    </Grid>
                                    <Grid size={{xs: 12, sm: 3}}>
                                        <Controller
                                            name={`customAdjustments.${originalIndex}.valueCents`}
                                            control={control}
                                            rules={{validate: validateSignedDollars}}
                                            render={({field, fieldState: {error}}) => (
                                                <TextField
                                                    {...field}
                                                    fullWidth
                                                    label="金额"
                                                    size="small"
                                                    autoComplete="off"
                                                    onBlur={() => {
                                                        // FIX: Only convert to cents if the value is a string from user input.
                                                        if (typeof field.value === 'string') {
                                                            const num = parseFloat(field.value);
                                                            field.onChange(isNaN(num) ? null : Math.round(num * 100));
                                                        }
                                                    }}
                                                    onChange={(e) => {
                                                        field.onChange(e.target.value);
                                                    }}
                                                    // Handle different value types for display
                                                    value={
                                                        field.value === null || field.value === undefined
                                                            ? ''
                                                            : typeof field.value === 'number'
                                                                // If number, it's cents; convert to dollars
                                                                ? (field.value / 100).toString()
                                                                // Otherwise, it's a string from user input; display as-is
                                                                : field.value
                                                    }
                                                    error={!!error}
                                                    helperText={error?.message ?? ' '}
                                                    InputProps={{
                                                        startAdornment: <InputAdornment
                                                            position="start">$</InputAdornment>
                                                    }}
                                                />
                                            )}
                                        />
                                    </Grid>
                                    <Grid size={12}>
                                        <Controller
                                            name={`customAdjustments.${originalIndex}.notes`}
                                            control={control}
                                            rules={{validate: createLengthValidator(50, '备注')}}
                                            render={({field, fieldState: {error}}) => (
                                                <TextField {...field}
                                                           fullWidth
                                                           autoComplete="off"
                                                           label="备注（可选）"
                                                           size="small"
                                                           multiline
                                                           minRows={1}
                                                           error={!!error}
                                                           helperText={error?.message || ''}/>
                                            )}
                                        />
                                    </Grid>
                                    <Grid size={12} display="flex" justifyContent="flex-end">
                                        <Tooltip title="删除此自定义报销">
                                            <IconButton color="error" onClick={() => remove(originalIndex)}
                                                        size="small">
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
