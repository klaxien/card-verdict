// dialogs/CashBackEditor.tsx
import React from 'react';
import {Dialog, DialogTitle, DialogContent, DialogActions, Button, Stack, TextField, Typography} from '@mui/material';
import {cardverdict} from '~/generated/bundle';

type CashBackCalculatorProps = {
    open: boolean;
    onClose: () => void;
    card: cardverdict.v1.ICreditCard;
};

const CashBackEditor: React.FC<CashBackCalculatorProps> = ({open, onClose, card}) => {
    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle>计算返现</DialogTitle>
            <DialogContent dividers>
                <Stack spacing={2}>
                    <Typography variant="body2" color="text.secondary">
                        这里展示用于计算 {card.name ?? '该卡'} 返现的输入项（占位）。
                    </Typography>
                    <TextField label="月消费额（$）" type="number" fullWidth />
                    <TextField label="类别加成说明（可选）" fullWidth />
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>取消</Button>
                <Button variant="contained" onClick={onClose}>计算</Button>
            </DialogActions>
        </Dialog>
    );
};

export default CashBackEditor;
