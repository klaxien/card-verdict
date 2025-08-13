import React, {useMemo, useState} from 'react';
import {
    Box,
    Button,
    Checkbox,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    FormControlLabel,
    Grid,
    InputAdornment,
    TextField,
    Tooltip,
    Typography
} from '@mui/material';
import {cardverdict} from '~/generated/bundle';
import {SearchOutlined} from "@mui/icons-material";

// --- 类型定义 ---
interface CardsFilterComponentProps {
    cardsByIssuer: Map<cardverdict.v1.Issuer, cardverdict.v1.ICreditCard[]>;
    allCardIds: string[];
    initialSelectedIds: Set<string>;
    onApplySelection: (selectedIds: Set<string>) => void;
}

// --- 辅助函数: Issuer 枚举到字符串 ---
const issuerToString = (issuer: cardverdict.v1.Issuer): string => {
    const issuerName = Object.keys(cardverdict.v1.Issuer).find(key => cardverdict.v1.Issuer[key as keyof typeof cardverdict.v1.Issuer] === issuer);
    if (!issuerName || issuerName === 'ISSUER_UNSPECIFIED') return 'Unknown';
    return issuerName.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
};

// --- 内部对话框组件 ---
type FilterDialogProps = {
    open: boolean;
    onClose: () => void;
    onApply: (selectedIds: Set<string>) => void;
    cardsByIssuer: Map<cardverdict.v1.Issuer, cardverdict.v1.ICreditCard[]>;
    allCardIds: string[];
    initialSelectedIds: Set<string>;
};

const FilterDialog: React.FC<FilterDialogProps> = ({
                                                       open,
                                                       onClose,
                                                       onApply,
                                                       cardsByIssuer,
                                                       allCardIds,
                                                       initialSelectedIds
                                                   }) => {
    const [localSelectedIds, setLocalSelectedIds] = useState(new Set(initialSelectedIds));
    const [localSearchTerm, setLocalSearchTerm] = useState('');

    React.useEffect(() => {
        if (open) {
            setLocalSelectedIds(new Set(initialSelectedIds));
        }
    }, [open, initialSelectedIds]);

    const filteredCardsByIssuer = useMemo(() => {
        if (localSearchTerm.trim() === '') return cardsByIssuer;
        const lowercasedTerm = localSearchTerm.toLowerCase();
        const newMap = new Map<cardverdict.v1.Issuer, cardverdict.v1.ICreditCard[]>();
        for (const [issuer, cards] of cardsByIssuer.entries()) {
            const filteredCards = cards.filter(card => (card.name || '').toLowerCase().includes(lowercasedTerm));
            if (filteredCards.length > 0) newMap.set(issuer, filteredCards);
        }
        return newMap;
    }, [cardsByIssuer, localSearchTerm]);

    const handleIssuerToggle = (cards: cardverdict.v1.ICreditCard[], isChecked: boolean) => {
        const newSelectedIds = new Set(localSelectedIds);
        cards.forEach(card => {
            if (card.cardId) {
                if (isChecked) newSelectedIds.add(card.cardId);
                else newSelectedIds.delete(card.cardId);
            }
        });
        setLocalSelectedIds(newSelectedIds);
    };

    const handleCardToggle = (cardId: string) => {
        const newSelectedIds = new Set(localSelectedIds);
        if (newSelectedIds.has(cardId)) newSelectedIds.delete(cardId);
        else newSelectedIds.add(cardId);
        setLocalSelectedIds(newSelectedIds);
    };

    const handleApply = () => {
        onApply(localSelectedIds);
        onClose();
    };

    const handleSelectAll = () => setLocalSelectedIds(new Set(allCardIds));
    const handleClearAll = () => setLocalSelectedIds(new Set());

    const handleClose = () => {
        setLocalSearchTerm('');
        onClose();
    };

    const isApplyDisabled = localSelectedIds.size === 0;

    return (
        <Dialog open={open} onClose={handleClose} fullWidth maxWidth="md">
            <DialogTitle>筛选与搜索</DialogTitle>
            <DialogContent dividers sx={{display: 'flex', flexDirection: 'column', gap: 2.5}}>
                <Box>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        快捷操作
                    </Typography>
                    {/* 这个 Box 使用 flexWrap 来确保未来的按钮可以自动换行，保证了可扩展性 */}
                    <Box sx={{display: 'flex', flexWrap: 'wrap', gap: 1}}>
                        <Button onClick={handleSelectAll} size="small" variant="outlined">全选所有</Button>
                        <Button onClick={handleClearAll} size="small" variant="outlined">清除所有选择</Button>
                        {/* 未来可在这里添加更多快捷按钮，如 <Button>0APR</Button> */}
                    </Box>
                </Box>
                <Box>
                    <TextField
                        fullWidth
                        placeholder="按名称搜索"
                        variant="outlined"
                        size="small"
                        value={localSearchTerm}
                        slotProps={{
                            input: {
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchOutlined/>
                                    </InputAdornment>
                                ),
                            },
                        }}
                        onChange={(e) => setLocalSearchTerm(e.target.value)}
                    />
                </Box>


                <Divider/>

                {/* --- 区域3: 卡片选择列表 --- */}
                <Box sx={{flexGrow: 1}}>
                    <Grid container spacing={2}>
                        {Array.from(filteredCardsByIssuer.entries()).map(([issuer, cards]) => {
                            const issuerCardIds = cards.map(c => c.cardId).filter(Boolean) as string[];
                            const selectedForIssuer = issuerCardIds.filter(id => localSelectedIds.has(id));
                            const isAllSelected = selectedForIssuer.length > 0 && selectedForIssuer.length === issuerCardIds.length;
                            const isPartiallySelected = selectedForIssuer.length > 0 && selectedForIssuer.length < issuerCardIds.length;

                            return (
                                <Grid size={{xs: 12, md: 12}} key={issuer}>
                                    <FormControlLabel
                                        label={<Typography variant="h6">{issuerToString(issuer)}</Typography>}
                                        control={<Checkbox checked={isAllSelected} indeterminate={isPartiallySelected}
                                                           onChange={(e) => handleIssuerToggle(cards, e.target.checked)}/>}
                                    />
                                    <Divider sx={{my: 1}}/>
                                    <Box sx={{display: 'flex', flexWrap: 'wrap', gap: 1}}>
                                        {cards.map(card => card.cardId && (
                                            <Chip
                                                key={card.cardId}
                                                label={card.name}
                                                clickable
                                                onClick={() => handleCardToggle(card.cardId!)}
                                                color={localSelectedIds.has(card.cardId) ? 'primary' : 'default'}
                                                variant={localSelectedIds.has(card.cardId) ? 'filled' : 'outlined'}
                                            />
                                        ))}
                                    </Box>
                                </Grid>
                            );
                        })}
                    </Grid>
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose}>取消</Button>
                <Tooltip title={isApplyDisabled ? "至少选中一张卡以应用" : ""}>
                    <span>
                        <Button onClick={handleApply} variant="contained" disabled={isApplyDisabled}>
                            应用
                        </Button>
                    </span>
                </Tooltip>
            </DialogActions>
        </Dialog>
    );
};


// --- 主组件 ---
const CardsFilterComponent: React.FC<CardsFilterComponentProps> = ({
                                                                       cardsByIssuer,
                                                                       allCardIds,
                                                                       initialSelectedIds,
                                                                       onApplySelection
                                                                   }) => {
    const [isDialogOpen, setDialogOpen] = useState(false);

    const isFilterActive = initialSelectedIds.size > 0 && initialSelectedIds.size < allCardIds.length;
    return (
        <>
            <Button variant="outlined" onClick={() => setDialogOpen(true)}>
                筛选 {isFilterActive ? `(${initialSelectedIds.size})` : ''}
            </Button>
            <FilterDialog
                open={isDialogOpen}
                onClose={() => setDialogOpen(false)}
                onApply={onApplySelection}
                cardsByIssuer={cardsByIssuer}
                allCardIds={allCardIds}
                initialSelectedIds={initialSelectedIds}
            />
        </>
    );
};

export default CardsFilterComponent;