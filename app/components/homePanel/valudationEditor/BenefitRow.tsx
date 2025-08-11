import React from 'react';
import {Box, Divider, Grid, InputAdornment, TextField, Typography,} from '@mui/material';
import {cardverdict} from '~/generated/bundle';
import {Controller, useFormContext} from 'react-hook-form';
import type {FormValues} from './ValuationEditComponent';
import {createLengthValidator} from "~/components/common/validators";
import {getBenefitDisplayDetails} from "~/components/homePanel/CreditCardComponent";

type BenefitRowProps = {
    benefit: cardverdict.v1.IOtherBenefit;
    index: number;
    faceDollars: number;
    isLastRow: boolean;
};

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

export const BenefitRow: React.FC<BenefitRowProps> = ({benefit, index, faceDollars, isLastRow}) => {
    const {control, setValue} = useFormContext<FormValues>();
    const hasProportionDefault = !!benefit.defaultEffectiveValueProportion;
    return (
        <Box>
            <Grid container alignItems="center" spacing={1}>
                <Grid size={{xs: 12, md: 6}}>
                    <Typography variant="subtitle2" sx={{wordBreak: 'break-word'}}>
                        {getBenefitDisplayDetails(benefit) || benefit.benefitId || '未命名福利'}
                    </Typography>

                </Grid>
                <Grid size={{xs: 12, md: 6}}>
                    <Grid container spacing={1}>
                        <Grid size={{xs: 'grow'}}>
                            <Controller name={`benefits.${index}.dollarsInput`} control={control}
                                        rules={{validate: validateDollars}}
                                        render={({field, fieldState: {error}}) => (
                                            <TextField {...field} size="small" fullWidth label="美元（年）"
                                                       autoComplete="off"
                                                       error={!!error} helperText={error?.message ?? ''}
                                                       placeholder={`自定义`}
                                                       slotProps={{
                                                           input: {
                                                               startAdornment: <InputAdornment
                                                                   position="start">$</InputAdornment>,
                                                               inputMode: 'decimal'
                                                           }
                                                       }}
                                                       onChange={e => {
                                                           field.onChange(e);
                                                           setValue(`benefits.${index}.lastEdited`, 'dollars');
                                                           const val = e.target.value;
                                                           if (validateDollars(val) === true && val.trim() !== '' && faceDollars > 0) {
                                                               const p = Number(val) / faceDollars;
                                                               setValue(`benefits.${index}.proportionInput`, p > 1 ? '1.00' : p.toFixed(2), {shouldValidate: true});
                                                           }
                                                       }}
                                            />
                                        )}/>
                        </Grid>
                        <Grid size={12}>
                            <Controller name={`benefits.${index}.explanation`} control={control}
                                        rules={{validate: createLengthValidator(50, '说明')}}
                                        render={({field, fieldState: {error}}) => (
                                            <TextField {...field} size="small" fullWidth label="说明（可选）"
                                                       autoComplete="off"
                                                       error={!!error} helperText={error?.message || ''}
                                                       placeholder={`默认：${benefit.defaultEffectiveValueExplanation ?? ''}`}
                                            />
                                        )}/>
                        </Grid>
                    </Grid>
                </Grid>
            </Grid>
            {!isLastRow && <Divider sx={{my: 1}}/>}
        </Box>
    );
};