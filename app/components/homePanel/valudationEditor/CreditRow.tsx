import React from 'react';
import {
    Box,
    Divider,
    Grid, // Grid V2
    IconButton,
    InputAdornment,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material';
import ClearIcon from '@mui/icons-material/Clear';
import {cardverdict} from '~/generated/bundle';
import {Controller, useFormContext} from 'react-hook-form';
import type {FormValues} from './ValuationEditComponent';

type Credit = cardverdict.v1.ICredit;

// 校验函数
const validateDollars = (value: string): true | string => {
    if (value.trim() === '') return true;
    if (!/^\d+(\.\d{1,2})?$/.test(value)) return '最多两位小数，且不能包含字母';
    return true;
};
const validateProportion = (value: string): true | string => {
    if (value.trim() === '') return true;
    const num = Number(value);
    if (Number.isNaN(num) || !/^\d+(\.\d{1,2})?$/.test(value)) return '最多两位小数';
    if (num < 0 || num > 1) return '需在 0 到 1 之间';
    return true;
};

type CreditRowProps = {
    credit: Credit;
    index: number;
    faceDollars: number;
    isLastRow: boolean;
};

export const CreditRow: React.FC<CreditRowProps> = ({credit, index, faceDollars, isLastRow}) => {
    const {control, setValue, watch, trigger} = useFormContext<FormValues>();

    const explanationValue = watch(`credits.${index}.explanation`);
    const showClear = (explanationValue?.trim() ?? '').length > 0;

    const handleClear = () => {
        setValue(`credits.${index}.dollarsInput`, '');
        setValue(`credits.${index}.proportionInput`, '');
        setValue(`credits.${index}.explanation`, '');
        setValue(`credits.${index}.lastEdited`, undefined);
        trigger([`credits.${index}.dollarsInput`, `credits.${index}.proportionInput`]);
    };

    const hasProportionDefault = !!credit.defaultEffectiveValueProportion;
    return (
        <Box>
            <Grid container alignItems="center" spacing={1}>
                <Grid size={{xs: 12, md: 6}}>
                    <Typography variant="subtitle2" sx={{wordBreak: 'break-word'}}>
                        {credit.details || credit.creditId || '未命名报销'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                        面值（年）约：
                        {Number.isInteger(faceDollars) ? faceDollars : faceDollars.toFixed(2)}
                        {hasProportionDefault &&
                            ` · 默认等效比例：${(credit.defaultEffectiveValueProportion)?.toFixed(2)}`}
                    </Typography>
                </Grid>

                <Grid size={{xs: 12, md: 6}}>
                    <Grid container spacing={1}>
                        <Grid size={{xs: 12, sm: 6}}>
                            <Controller
                                name={`credits.${index}.dollarsInput`}
                                control={control}
                                rules={{validate: validateDollars}}
                                render={({field, fieldState: {error}}) => (
                                    <TextField
                                        {...field} size="small" fullWidth label="美元（年）"
                                        autoComplete="off"
                                        error={!!error} helperText={error?.message ?? ''}
                                        placeholder={`0 - ${Number.isInteger(faceDollars) ? faceDollars : faceDollars.toFixed(2)}`}
                                        slotProps={{
                                            input: {
                                                startAdornment: <InputAdornment position="start">$</InputAdornment>,
                                                inputMode: 'decimal',
                                            },
                                        }}
                                        onChange={e => {
                                            field.onChange(e);
                                            setValue(`credits.${index}.lastEdited`, 'dollars');
                                            const val = e.target.value;
                                            if (validateDollars(val) === true && val.trim() !== '' && faceDollars > 0) {
                                                const p = Number(val) / faceDollars;
                                                setValue(`credits.${index}.proportionInput`, p > 1 ? '1.00' : p.toFixed(2), {shouldValidate: true});
                                            }
                                        }}
                                    />
                                )}
                            />
                        </Grid>
                        <Grid size={{xs: 12, sm: 6}}>
                            <Controller
                                name={`credits.${index}.proportionInput`}
                                control={control}
                                rules={{validate: validateProportion}}
                                render={({field, fieldState: {error}}) => (
                                    <TextField
                                        {...field} size="small" fullWidth label="等效比例 (0-1)"
                                        error={!!error} helperText={error?.message ?? ''}
                                        onChange={e => {
                                            field.onChange(e);
                                            setValue(`credits.${index}.lastEdited`, 'proportion');
                                            const val = e.target.value;
                                            if (validateProportion(val) === true && val.trim() !== '') {
                                                setValue(`credits.${index}.dollarsInput`, (Number(val) * faceDollars).toFixed(2), {shouldValidate: true});
                                            }
                                        }}
                                    />
                                )}
                            />
                        </Grid>
                        <Grid size={12}>
                            <Controller
                                name={`credits.${index}.explanation`}
                                control={control}
                                render={({field}) => (
                                    <TextField
                                        {...field} size="small" fullWidth label="说明（可选）"
                                        autoComplete="off"
                                        placeholder={`默认：${credit.defaultEffectiveValueExplanation ?? ''}`}
                                        slotProps={{
                                            input: showClear
                                                ? {
                                                    endAdornment: (
                                                        <InputAdornment position="end">
                                                            <Tooltip title="清空此行">
                                                                <IconButton aria-label="clear row" size="small"
                                                                            onClick={handleClear}>
                                                                    <ClearIcon fontSize="small"/>
                                                                </IconButton>
                                                            </Tooltip>
                                                        </InputAdornment>
                                                    ),
                                                }
                                                : undefined,
                                        }}
                                    />
                                )}
                            />
                        </Grid>
                    </Grid>
                </Grid>
            </Grid>
            {!isLastRow && <Divider sx={{my: 1}}/>}
        </Box>
    );
};
