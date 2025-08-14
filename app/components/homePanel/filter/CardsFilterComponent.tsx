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

// 定义筛选模式
type FilterMode = 'SELECT_ALL' | 'CLEAR_ALL' | 'PERSONAL_ONLY' | 'BUSINESS_ONLY' | 'CUSTOM';

// --- 辅助函数: Issuer 枚举到字符串 ---
const issuerToString = (issuer: cardverdict.v1.Issuer): string => {
    const issuerName = Object.keys(cardverdict.v1.Issuer).find(key => cardverdict.v1.Issuer[key as keyof typeof cardverdict.v1.Issuer] === issuer);
    if (!issuerName || issuerName === 'ISSUER_UNSPECIFIED') return 'Unknown';
    return issuerName.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
};

// 辅助函数: 比较两个 Set 是否相等
const isSetEqual = (a: Set<string>, b: Set<string>): boolean => {
    if (a.size !== b.size) return false;
    for (const item of a) {
        if (!b.has(item)) return false;
    }
    return true;
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
    // 新增一个状态来明确追踪用户选择的模式
    const [selectedMode, setSelectedMode] = useState<FilterMode>('CUSTOM');
    // 状态，用于“记忆”上一次的自定义选择
    const [lastCustomSelection, setLastCustomSelection] = useState<Set<string>>(new Set());


    //  预先计算出所有个人卡和商业卡的ID
    const {personalCardIds, businessCardIds} = useMemo(() => {
        const personal = new Set<string>();
        const business = new Set<string>();
        for (const cards of cardsByIssuer.values()) {
            cards.forEach(card => {
                if (!card.cardId) return;
                if (card.cardType === cardverdict.v1.CardType.BUSINESS) {
                    business.add(card.cardId);
                } else {
                    personal.add(card.cardId);
                }
            });
        }
        return {personalCardIds: personal, businessCardIds: business};
    }, [cardsByIssuer]);

    // 计算模式的辅助函数，不再是 useMemo
    const calculateMode = (selection: Set<string>): FilterMode => {
        if (isSetEqual(selection, new Set(allCardIds))) return 'SELECT_ALL';
        if (selection.size === 0) return 'CLEAR_ALL';
        if (isSetEqual(selection, personalCardIds)) return 'PERSONAL_ONLY';
        if (isSetEqual(selection, businessCardIds)) return 'BUSINESS_ONLY';
        return 'CUSTOM';
    };


    React.useEffect(() => {
        if (open) {
            // 当对话框打开时，从父组件加载上一次应用的状态
            const initialSelection = initialSelectedIds.size > 0 ? initialSelectedIds : personalCardIds;
            setLocalSelectedIds(new Set(initialSelection));

            const initialMode = calculateMode(initialSelection);
            setSelectedMode(initialMode);

            if (initialMode === 'CUSTOM') {
                setLastCustomSelection(new Set(initialSelection));
            } else {
                // 如果初始状态不是自定义，清空自定义记忆，确保下次点击自定义时是从0开始
                setLastCustomSelection(new Set());
            }

            setLocalSearchTerm('');
        }
    }, [open, initialSelectedIds, allCardIds, personalCardIds, businessCardIds]); // 依赖项更新

    // (当选择变化时，如果是自定义模式，则更新“记忆”
    React.useEffect(() => {
        if (selectedMode === 'CUSTOM') {
            setLastCustomSelection(new Set(localSelectedIds));
        }
    }, [localSelectedIds, selectedMode]);


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
        // 手动修改后，模式变为自定义
        setSelectedMode('CUSTOM');
    };

    const handleCardToggle = (cardId: string) => {
        const newSelectedIds = new Set(localSelectedIds);
        if (newSelectedIds.has(cardId)) newSelectedIds.delete(cardId);
        else newSelectedIds.add(cardId);
        setLocalSelectedIds(newSelectedIds);
        //  手动修改后，模式变为自定义
        setSelectedMode('CUSTOM');
    };

    const handleApply = () => {
        onApply(localSelectedIds);
        onClose();
    };

    //  快捷模式切换的核心逻辑
    const handleModeChange = (mode: FilterMode) => {
        setSelectedMode(mode); // 首先，更新用户的意图

        // 然后，根据意图更新选择
        switch (mode) {
            case 'SELECT_ALL':
                setLocalSelectedIds(new Set(allCardIds));
                break;
            case 'CLEAR_ALL':
                setLocalSelectedIds(new Set());
                break;
            case 'PERSONAL_ONLY':
                setLocalSelectedIds(new Set(personalCardIds));
                break;
            case 'BUSINESS_ONLY':
                setLocalSelectedIds(new Set(businessCardIds));
                break;
            case 'CUSTOM':
                // 恢复记忆，如果记忆为空，则清空选择
                setLocalSelectedIds(new Set(lastCustomSelection));
                break;
        }
    };

    const handleClose = () => {
        onClose();
    };

    // 任何情况下，只要没有选中的卡片，应用按钮就应该被禁用。
    const isApplyDisabled = localSelectedIds.size === 0;

    const filterModes: { mode: FilterMode; label: string }[] = [
        {mode: 'SELECT_ALL', label: '全选所有'},
        {mode: 'CLEAR_ALL', label: '清除所有选择'},
        {mode: 'PERSONAL_ONLY', label: '只看个人卡'},
        {mode: 'BUSINESS_ONLY', label: '只看商业卡'},
        {mode: 'CUSTOM', label: '自定义'},
    ];


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
                        {filterModes.map(({mode, label}) => (
                            <Chip
                                key={mode}
                                label={label}
                                clickable
                                onClick={() => handleModeChange(mode)}
                                color={selectedMode === mode ? 'primary' : 'default'}
                                variant={selectedMode === mode ? 'filled' : 'outlined'}
                            />
                        ))}
                    </Box>
                </Box>
                <Box>
                    <TextField
                        fullWidth
                        placeholder="按名称搜索"
                        variant="outlined"
                        size="small"
                        value={localSearchTerm}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchOutlined/>
                                </InputAdornment>
                            ),
                        }}
                        onChange={(e) => setLocalSearchTerm(e.target.value)}
                    />
                </Box>


                <Divider/>

                {/* --- 区域3: 卡片选择列表 --- */}
                <Box sx={{flexGrow: 1, overflowY: 'auto'}}>
                    <Grid container spacing={2}>
                        {Array.from(filteredCardsByIssuer.entries()).map(([issuer, cards]) => {
                            const issuerCardIds = cards.map(c => c.cardId).filter(Boolean) as string[];
                            const selectedForIssuer = issuerCardIds.filter(id => localSelectedIds.has(id));
                            const isAllSelected = issuerCardIds.length > 0 && selectedForIssuer.length === issuerCardIds.length;
                            const isPartiallySelected = selectedForIssuer.length > 0 && selectedForIssuer.length < issuerCardIds.length;

                            return (
                                <Grid size={{xs: 12}} key={issuer}>
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

    const isFilterActive = useMemo(() => {
        // 如果没有应用过筛选，则不显示激活状态
        if (initialSelectedIds.size === 0) return false;
        // 如果全选了，也不算激活
        if (initialSelectedIds.size === allCardIds.length) return false;

        return true;
    }, [initialSelectedIds, allCardIds]);


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