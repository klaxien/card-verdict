// dialogs/ShareValuation.tsx
import React from 'react';
import {Dialog, DialogTitle, DialogContent, DialogActions, Button, Stack, TextField, Typography} from '@mui/material';
import {cardverdict, userprofile} from '~/generated/bundle';

type ShareValuationProps = {
    open: boolean;
    onClose: () => void;
    card: cardverdict.v1.ICreditCard;
    valuation?: userprofile.v1.IUserCardValuation;
};

const ShareValuation: React.FC<ShareValuationProps> = ({open, onClose, card, valuation}) => {
    const defaultMessage = `分享我对「${card.name ?? '这张卡'}」的估值：净值/细项等（占位）。`;

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle>分享</DialogTitle>
            <DialogContent dividers>
                <Stack spacing={2}>
                    <Typography variant="body2" color="text.secondary">
                        可以在此预览或编辑分享文案（占位）。当前估值对象已加载：{valuation ? '是' : '否'}
                    </Typography>
                    <TextField
                        label="分享文案"
                        defaultValue={defaultMessage}
                        fullWidth
                        multiline
                        minRows={3}
                    />
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>关闭</Button>
                <Button variant="contained" onClick={onClose}>复制/分享</Button>
            </DialogActions>
        </Dialog>
    );
};

export default ShareValuation;
