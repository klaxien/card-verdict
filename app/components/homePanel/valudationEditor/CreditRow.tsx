import React from 'react';
import {Box, Divider, Grid, IconButton, InputAdornment, TextField, Tooltip, Typography,} from '@mui/material';
import ClearIcon from '@mui/icons-material/Clear';
import {cardverdict} from '~/generated/bundle';
import {Controller, useFormContext} from 'react-hook-form';
import type {FormValues} from './ValuationEditComponent';
import {createLengthValidator} from "~/components/common/validators";
import {formatWithoutTrailingZeroes} from "~/components/homePanel/utils/creditCardDisplayUtils";

type Credit = cardverdict.v1.ICredit;

// ========================================================================
// 1. 更新验证函数
// ========================================================================

const validateDollars = (value: string): true | string => {
    if (value.trim() === '') return true;
    if (!/^\d*(\.\d{1,2})?$/.test(value) || Number.isNaN(Number(value))) {
        return '必须是大于等于0的数字，最多两位小数';
    }
    return true;
};

const validateProportion = (value: string): true | string => {
    if (value.trim() === '') return true;
    const num = Number(value);
    if (Number.isNaN(num) || num < 0 || !/^\d*(\.\d{1,2})?$/.test(value)) {
        return '必须是大于等于0的数字，最多两位小数';
    }
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
                        面值（年）：
                        ${formatWithoutTrailingZeroes(faceDollars)}
                        {hasProportionDefault &&
                            ` · 默认等效比例：${formatWithoutTrailingZeroes(credit.defaultEffectiveValueProportion ?? 0)}`}
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
                                        placeholder={`面值: ${formatWithoutTrailingZeroes(faceDollars)}`}
                                        InputProps={{
                                            startAdornment: <InputAdornment position="start">$</InputAdornment>,
                                        }}
                                        inputProps={{
                                            inputMode: 'decimal'
                                        }}
                                        onChange={e => {
                                            field.onChange(e);
                                            setValue(`credits.${index}.lastEdited`, 'dollars');
                                            const val = e.target.value;
                                            if (validateDollars(val) === true && val.trim() !== '' && faceDollars > 0) {
                                                const p = Number(val) / faceDollars;
                                                setValue(`credits.${index}.proportionInput`, p.toFixed(2), {shouldValidate: true});
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
                                        // ========================================================================
                                        // 3. 更新 Label, 移除 (0-1)
                                        // ========================================================================
                                        {...field} size="small" fullWidth label="等效比例 (≥ 0)"
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
                                rules={{validate: createLengthValidator(50, '说明')}}
                                render={({field, fieldState: {error}}) => (
                                    <TextField
                                        {...field} size="small" fullWidth label="说明（可选）"
                                        autoComplete="off"
                                        error={!!error}
                                        helperText={error?.message || ''}
                                        placeholder={`默认：${credit.defaultEffectiveValueExplanation ?? ''}`}
                                        InputProps={{ // 注意：MUI v5 中 InputProps 替代了 slotProps.input
                                            endAdornment: showClear ? (
                                                <InputAdornment position="end">
                                                    <Tooltip title="清空此行">
                                                        <IconButton aria-label="clear row" size="small"
                                                                    onClick={handleClear}>
                                                            <ClearIcon fontSize="small"/>
                                                        </IconButton>
                                                    </Tooltip>
                                                </InputAdornment>
                                            ) : undefined,
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
