import React from 'react';
import {
    Box,
    Divider,
    FormControl,
    Grid,
    InputAdornment,
    InputLabel,
    MenuItem,
    Select,
    Stack,
    TextField,
    Typography
} from '@mui/material';
import {type Control, Controller, type FieldArrayWithId} from 'react-hook-form';
import {type FormValues} from './CashBackEditor';
import {frequencyOptions, validateOptionalAmount} from './cashBackUtils';
import {createLengthValidator} from '~/components/common/validators';

type OfficialSpendingsEditorProps = {
    control: Control<FormValues>;
    fields: FieldArrayWithId<FormValues, 'spendings', 'id'>[];
};

export const OfficialSpendingsEditor: React.FC<OfficialSpendingsEditorProps> = ({control, fields}) => {
    // 筛选出非自定义的消费类别及其在原始数组中的索引
    const officialSpendings = fields
        .map((field, index) => ({field, originalIndex: index}))
        .filter(({field}) => !field.isCustom);

    if (officialSpendings.length === 0) {
        return null;
    }

    return (
        <Stack divider={<Divider flexItem/>}>
            {officialSpendings.map(({field, originalIndex}) => (
                <Box key={field.id} sx={{py: 2}}>
                    <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                        {field.description}
                    </Typography>
                    <Grid container spacing={{xs: 2, md: 3}} alignItems="flex-start">
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
                </Box>
            ))}
        </Stack>
    );
};
