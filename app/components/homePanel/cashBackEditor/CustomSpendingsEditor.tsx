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
    Typography
} from '@mui/material';
import {type Control, Controller, type FieldArrayWithId, type UseFieldArrayRemove} from 'react-hook-form';
import DeleteIcon from '@mui/icons-material/Delete';
import type {FormValues} from './CashBackEditor';
import {frequencyOptions, validateOptionalAmount} from './cashBackUtils';
import {createLengthValidator} from '~/components/common/validators';

type CustomSpendingsEditorProps = {
    control: Control<FormValues>;
    fields: FieldArrayWithId<FormValues, 'spendings', 'id'>[];
    remove: UseFieldArrayRemove;
    onAdd: () => void;
};


export const CustomSpendingsEditor: React.FC<CustomSpendingsEditorProps> = ({control, fields, remove, onAdd}) => {
    // 筛选出自定义的消费类别及其原始索引
    const customSpendings = fields
        .map((field, index) => ({field, originalIndex: index}))
        .filter(({field}) => field.isCustom);

    return (
        <Stack spacing={2} sx={{mt: 2, pt: 2, borderTop: 1, borderColor: 'divider'}}>

            <Box display="flex" alignItems="center" justifyContent="space-between" sx={{mb: 1}}>
                <Typography variant="h6" component="div">
                    自定义消费类别
                </Typography>
                <Button variant="outlined" onClick={onAdd}>
                    添加自定义消费类别
                </Button>
            </Box>

            {customSpendings.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                    暂无自定义消费类别。点击“添加自定义消费类别”新建一条。
                </Typography>
            ) : undefined}

            {customSpendings.map(({field, originalIndex}) => (
                <Box key={field.id} sx={{border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1.5}}>
                    <Grid container spacing={2} alignItems="flex-start">
                        <Grid size={{xs: 12, sm: 7}}>
                            <Controller
                                name={`spendings.${originalIndex}.description`}
                                control={control}
                                rules={{required: '描述不能为空', validate: createLengthValidator(30, '描述')}}
                                render={({field: descField, fieldState}) => (
                                    <TextField
                                        {...descField}
                                        fullWidth
                                        autoComplete="off"
                                        label="自定义类别描述"
                                        size="small"
                                        error={!!fieldState.error}
                                        helperText={fieldState.error?.message || ' '}
                                    />
                                )}
                            />
                        </Grid>
                        <Grid size={{xs: 9, sm: 5}}>
                            <Controller
                                name={`spendings.${originalIndex}.multiplier`}
                                control={control}
                                rules={{validate: v => !isNaN(parseFloat(String(v))) && parseFloat(String(v)) >= 0 || '必须是非负数'}}
                                render={({field: multField, fieldState}) => (
                                    <TextField
                                        {...multField}
                                        fullWidth
                                        autoComplete="off"
                                        label="返现乘数"
                                        size="small"
                                        InputProps={{
                                            endAdornment: <InputAdornment position="end">倍点数</InputAdornment>
                                        }}
                                        error={!!fieldState.error}
                                        helperText={fieldState.error?.message || ' '}
                                    />
                                )}
                            />
                        </Grid>
                        <Grid size={{xs: 12, sm: 4}}>
                            <Controller
                                name={`spendings.${originalIndex}.amountInput`}
                                control={control}
                                rules={{validate: validateOptionalAmount}}
                                render={({field: controllerField, fieldState: {error}}) => (
                                    <TextField
                                        {...controllerField}
                                        fullWidth
                                        autoComplete="off"
                                        label="计划消费额"
                                        error={!!error}
                                        helperText={error?.message || ' '}
                                        InputProps={{
                                            startAdornment: <InputAdornment position="start">$</InputAdornment>
                                        }}
                                        inputProps={{min: 0, inputMode: 'decimal'}}
                                        size="small"
                                    />
                                )}
                            />
                        </Grid>
                        <Grid size={{xs: 12, sm: 4}}>
                            <Controller
                                name={`spendings.${originalIndex}.frequency`}
                                control={control}
                                render={({field: controllerField}) => (
                                    <FormControl fullWidth size="small">
                                        <InputLabel>频率</InputLabel>
                                        <Select {...controllerField} label="频率">
                                            {frequencyOptions.map(opt => (
                                                <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                )}
                            />
                        </Grid>
                        <Grid size={{xs: 12, sm: 4}}>
                            <Controller
                                name={`spendings.${originalIndex}.notes`}
                                control={control}
                                rules={{validate: createLengthValidator(50, '备注')}}
                                render={({field: controllerField, fieldState: {error}}) => (
                                    <TextField
                                        {...controllerField}
                                        fullWidth
                                        autoComplete="off"
                                        label="备注 (可选)"
                                        size="small"
                                        error={!!error}
                                        helperText={error?.message || ' '}
                                    />
                                )}
                            />
                        </Grid>
                    </Grid>
                    <Grid size={12} display="flex" justifyContent="flex-end">
                        <Tooltip title="删除此自定义类别">
                            <IconButton color="error" onClick={() => remove(originalIndex)} size="small">
                                <DeleteIcon/>
                            </IconButton>
                        </Tooltip>
                    </Grid>
                </Box>
            ))}


            {/*<Grid size={12} display="flex" justifyContent="flex-end">*/}
            {/*    <Tooltip title="删除此自定义报销">*/}
            {/*        <IconButton color="error" onClick={() => remove(originalIndex)} size="small">*/}
            {/*            <DeleteIcon fontSize="small" />*/}
            {/*        </IconButton>*/}
            {/*    </Tooltip>*/}
            {/*</Grid>*/}
        </Stack>
    );
};
