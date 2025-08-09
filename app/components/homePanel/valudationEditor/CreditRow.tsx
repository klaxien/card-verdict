import React from 'react';
import {
    Box,
    Divider,
    Grid,
    IconButton,
    InputAdornment,
    TextField,
    Tooltip,
    Typography,
    useMediaQuery,
    useTheme,
} from '@mui/material';
import ClearIcon from '@mui/icons-material/Clear';
import {cardverdict} from '~/generated/bundle';

type Credit = cardverdict.v1.ICredit;
type LastEdited = 'dollars' | 'proportion' | undefined;

type RowState = {
    dollarsInput: string;
    proportionInput: string;
    explanation: string;
    lastEdited: LastEdited;
    dollarsError?: string | null;
    proportionError?: string | null;
};

type CreditRowProps = {
    credit: Credit;
    row: RowState;
    faceDollars: number;
    hasProportionDefault: boolean;
    isLastRow: boolean;
    onChange: (patch: Partial<RowState>, source?: LastEdited) => void;
    onBlur: (field: 'dollars' | 'proportion') => void;
    onClear: () => void;
};

export const CreditRow: React.FC<CreditRowProps> = ({
                                                        credit,
                                                        row,
                                                        faceDollars,
                                                        hasProportionDefault,
                                                        isLastRow,
                                                        onChange,
                                                        onBlur,
                                                        onClear,
                                                    }) => {
    const creditId = credit.creditId ?? '';
    const showClear = (row.explanation?.trim().length ?? 0) > 0;

    const theme = useTheme();
    const isSmUp = useMediaQuery(theme.breakpoints.up('sm'));

    const dollarsHelperText = row.dollarsError
        ? row.dollarsError
        : (isSmUp && row.proportionError ? ' ' : '');

    const proportionHelperText = row.proportionError
        ? row.proportionError
        : (isSmUp && row.dollarsError ? ' ' : '');

    return (
        <Box key={creditId}>
            <Grid container alignItems="center" spacing={1}>
                <Grid size={{xs: 12, md: 6}}>
                    <Typography variant="subtitle2" sx={{wordBreak: 'break-word'}}>
                        {credit.details || creditId || '未命名报销'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                        面值（年）约：$
                        {Number.isInteger(faceDollars) ? faceDollars : faceDollars.toFixed(2)}
                        {hasProportionDefault &&
                            ` · 默认等效比例：${(credit.defaultEffectiveValueProportion).toFixed(2)}`}
                    </Typography>
                </Grid>

                <Grid size={{xs: 12, md: 6}}>
                    <Grid container spacing={1} alignItems="center">
                        <Grid size={{xs: 12, sm: 6}}>
                            <TextField
                                size="small"
                                fullWidth
                                autoComplete="off"
                                label="美元（年）"
                                placeholder={`(0 - ${Number.isInteger(faceDollars) ? faceDollars : faceDollars.toFixed(2)})`}
                                value={row.dollarsInput}
                                onChange={(e) => onChange({dollarsInput: e.target.value}, 'dollars')}
                                onBlur={() => onBlur('dollars')}
                                error={!!row.dollarsError}
                                helperText={dollarsHelperText}
                                slotProps={{
                                    input: {
                                        startAdornment: <InputAdornment position="start">$</InputAdornment>,
                                        inputMode: 'decimal',
                                    },
                                }}
                            />
                        </Grid>

                        <Grid size={{xs: 12, sm: 6}}>
                            <TextField
                                size="small"
                                fullWidth
                                autoComplete="off"
                                label="等效比例 (0-1)"
                                placeholder="例如：0.75"
                                value={row.proportionInput}
                                onChange={(e) => onChange({proportionInput: e.target.value}, 'proportion')}
                                onBlur={() => onBlur('proportion')}
                                error={!!row.proportionError}
                                helperText={proportionHelperText}
                                slotProps={{
                                    input: {
                                        inputMode: 'decimal',
                                    },
                                }}
                            />
                        </Grid>

                        <Grid size={{xs: 12}}>
                            <TextField
                                size="small"
                                fullWidth
                                label="说明（可选）"
                                placeholder={`如：${credit.defaultEffectiveValueExplanation ?? ''}`}
                                value={row.explanation}
                                onChange={(e) => onChange({explanation: e.target.value})}
                                slotProps={{
                                    input: showClear
                                        ? {
                                            endAdornment: (
                                                <InputAdornment position="end">
                                                    <Tooltip title="清空此行">
                                                        <IconButton aria-label="clear row" size="small"
                                                                    onClick={onClear}>
                                                            <ClearIcon fontSize="small"/>
                                                        </IconButton>
                                                    </Tooltip>
                                                </InputAdornment>
                                            ),
                                        }
                                        : undefined,
                                }}
                            />
                        </Grid>
                    </Grid>
                </Grid>
            </Grid>
            {!isLastRow && <Divider sx={{my: 1}}/>}
        </Box>
    );
};
