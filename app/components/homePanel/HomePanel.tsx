import React, {useEffect, useMemo, useState} from 'react';
import {
    Alert,
    Box,
    CircularProgress,
    FormControl,
    Grid,
    InputLabel,
    MenuItem,
    Select,
    type SelectChangeEvent,
    Typography,
} from '@mui/material';
import {getCardDatabase} from '~/client/cardDetailsFetcher';
import {cardverdict, userprofile} from '~/generated/bundle';
import CreditCardComponent from '~/components/homePanel/CreditCardComponent';
import {DataCorruptionError, loadActiveValuationProfile,} from '~/client/userSettingsPersistence';
import {calculateNetWorth} from '~/utils/cardCalculations';
import EmergencyDataDialog from "~/components/dataManagement/EmergencyDataDialog";
import CardsFilterComponent from "~/components/homePanel/filter/CardsFilterComponent";

// --- 类型定义 ---
type SortOrder = 'net-high-to-low' | 'net-low-to-high' | 'credits-high-to-low' | 'credits-low-to-high';

interface EmergencyState {
    message: string;
    corruptedBase64: string | null;
}

const HomePanel: React.FC = () => {
    // --- 核心数据状态 ---
    const [cardData, setCardData] = useState<cardverdict.v1.CreditCardDatabase | null>(null);
    const [userValuationDb, setUserValuationDb] = useState<userprofile.v1.IValuationProfile | null>(null);
    const [loading, setLoading] = useState(true);

    // --- 错误处理状态 ---
    const [genericError, setGenericError] = useState<string | null>(null);
    const [emergencyState, setEmergencyState] = useState<EmergencyState | null>(null);

    // --- UI与筛选状态 ---
    const [sortOrder, setSortOrder] = useState<SortOrder>('net-high-to-low');
    const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(new Set());
    const [filterHasBeenApplied, setFilterHasBeenApplied] = useState(false);

    useEffect(() => {
        const fetchAllData = async () => {
            setLoading(true);

            // --- 步骤1: 加载用户设置，并精确捕获数据损坏异常 ---
            try {
                const db = loadActiveValuationProfile();
                setUserValuationDb(db);
            } catch (err) {
                if (err instanceof DataCorruptionError) {
                    console.error("Data corruption detected, entering emergency mode:", err);
                    console.error({
                        message: err.message,
                        corruptedBase64: err.corruptedData,
                    });
                    // 设置紧急状态，这将强制打开恢复对话框
                    setEmergencyState({
                        message: err.message,
                        corruptedBase64: err.corruptedData,
                    });
                    // 注意：我们在此处不 return 或 setLoading(false)。
                    // 即使数据损坏，我们仍会继续尝试加载主卡片数据库，
                    // 以便在对话框后面能显示应用的基本UI，而不是白屏。
                } else {
                    // 对于其他非数据损坏的错误，显示通用错误信息并停止
                    const errorMessage = err instanceof Error ? err.message : '加载用户配置时发生未知错误';
                    setGenericError(errorMessage);
                    setLoading(false);
                    return; // 终止加载流程
                }
            }

            // --- 步骤2: 加载主卡片数据库 ---
            try {
                const data = await getCardDatabase();
                setCardData(data);
            } catch (err) {
                // 这是网络错误等，显示通用错误信息
                setGenericError(err instanceof Error ? err.message : '无法加载信用卡数据库');
            } finally {
                // 无论结果如何，最终都结束加载状态
                setLoading(false);
            }
        };

        fetchAllData();
    }, []);

    // 按发卡行对卡片进行分组，供筛选器使用
    const {cardsByIssuer, allCardIds} = useMemo(() => {
        if (!cardData?.cards) {
            return {cardsByIssuer: new Map(), allCardIds: []};
        }
        const allIds = cardData.cards.map(c => c.cardId).filter(Boolean) as string[];
        const grouped = cardData.cards.reduce((acc, card) => {
            const issuer = card.issuer ?? cardverdict.v1.Issuer.ISSUER_UNSPECIFIED;
            const group = acc.get(issuer) || [];
            group.push(card);
            acc.set(issuer, group);
            return acc;
        }, new Map<cardverdict.v1.Issuer, cardverdict.v1.ICreditCard[]>());
        const sortedGrouped = new Map([...grouped.entries()].sort((a, b) => a[0] - b[0]));
        return {cardsByIssuer: sortedGrouped, allCardIds: allIds};
    }, [cardData?.cards]);

    // 计算最终要展示的、经过筛选和排序的卡片列表
    const sortedCards = useMemo(() => {
        if (!cardData?.cards) return [];

        let cardsToDisplay: cardverdict.v1.ICreditCard[];

        // 关键逻辑: 区分初始状态和已应用筛选的状态
        if (!filterHasBeenApplied) {
            // 在用户第一次应用筛选之前，显示所有卡片
            cardsToDisplay = cardData.cards;
        } else {
            // 一旦用户应用了筛选，就严格按照 selectedIds 来显示。
            // 如果 selectedIds 为空, cardsToDisplay 也将为空。
            cardsToDisplay = cardData.cards.filter(card => card.cardId && selectedCardIds.has(card.cardId));
        }

        const cardsToSort = [...cardsToDisplay];

        // 排序逻辑
        const getUserValuation = (card: cardverdict.v1.ICreditCard, valuationDb: userprofile.v1.IValuationProfile | null) => valuationDb?.cardValuations?.[card.cardId ?? ''];
        cardsToSort.sort((a, b) => {
            switch (sortOrder) {
                case 'net-high-to-low':
                    return calculateNetWorth(b, getUserValuation(b, userValuationDb)) - calculateNetWorth(a, getUserValuation(a, userValuationDb));
                case 'net-low-to-high':
                    return calculateNetWorth(a, getUserValuation(a, userValuationDb)) - calculateNetWorth(b, getUserValuation(b, userValuationDb));
                case 'credits-high-to-low':
                    return (b.credits?.length ?? 0) - (a.credits?.length ?? 0);
                case 'credits-low-to-high':
                    return (a.credits?.length ?? 0) - (b.credits?.length ?? 0);
                default:
                    return 0;
            }
        });
        return cardsToSort;
    }, [cardData?.cards, userValuationDb, sortOrder, selectedCardIds, filterHasBeenApplied]);

    // 紧急数据恢复成功后的操作
    const handleActionSuccess = () => {
        // 在恢复或清除数据成功后，最可靠的方式是刷新整个应用
        window.location.reload();
    };

    // 处理从筛选组件传来的新选择
    const handleApplyFilters = (newSelectedIds: Set<string>) => {
        setSelectedCardIds(newSelectedIds);
        setFilterHasBeenApplied(true); // 标记筛选器已应用
    };

    // --- 渲染部分 ---
    if (loading) {
        return (
            <div className="flex justify-center items-center h-screen">
                <Box display="flex" flexDirection="column" alignItems="center" gap={2}>
                    <CircularProgress
                        size={72}
                        thickness={4.5}
                        disableShrink
                        sx={{
                            '& .MuiCircularProgress-circle': {
                                strokeLinecap: 'butt', // 端点不圆润，看起来更像连续环
                            },
                        }}
                    />
                    <Typography variant="body1" color="text.secondary">
                        Loading...
                    </Typography>
                </Box>
            </div>
        );
    }

    if (genericError) {
        // 仅在没有打开备份对话框时显示通用错误，避免UI重叠
        return <div className="p-4"><Alert severity="error">{genericError}</Alert></div>;
    }

    return (
        <div className="p-4">
            <Box sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: 2,
                flexWrap: 'wrap',
                gap: 2
            }}>
                <CardsFilterComponent
                    cardsByIssuer={cardsByIssuer}
                    allCardIds={allCardIds}
                    initialSelectedIds={selectedCardIds}
                    onApplySelection={handleApplyFilters}
                />

                <FormControl size="small" sx={{minWidth: 180}}>
                    <InputLabel id="sort-order-label">排序</InputLabel>
                    <Select
                        labelId="sort-order-label"
                        id="sort-order-select"
                        value={sortOrder}
                        label="排序"
                        onChange={(e: SelectChangeEvent<SortOrder>) => setSortOrder(e.target.value as SortOrder)}
                    >
                        <MenuItem value="net-high-to-low">净值 (从高到低)</MenuItem>
                        <MenuItem value="net-low-to-high">净值 (从低到高)</MenuItem>
                        <MenuItem value="credits-high-to-low">coupon数 (从高到低)</MenuItem>
                        <MenuItem value="credits-low-to-high">coupon数 (从低到高)</MenuItem>
                    </Select>
                </FormControl>
            </Box>

            <Grid container spacing={3}>
                {sortedCards.length > 0 ? (
                    sortedCards.map((card) => (
                        // 使用 Grid item 来包裹每个卡片
                        // xs={12}: 在超小屏幕上 (extra-small), 每行1个卡片 (12/12)
                        // sm={6}: 在小屏幕上 (small), 每行2个卡片 (12/6)
                        // md={4}: 在中等及以上屏幕上 (medium), 每行3个卡片 (12/4)
                        // xl={3}: 每行4个卡片 (12/3)
                        <Grid key={card.cardId} size={{xs: 12, sm: 6, md: 4, xl: 3}}>
                            <CreditCardComponent
                                card={card}
                                initialValuation={userValuationDb?.cardValuations?.[card.cardId ?? '']}
                                pointSystemValuations={userValuationDb?.pointSystemValuations}
                            />
                        </Grid>
                    ))
                ) : (
                    <Grid size={{xs: 12}}>
                        <Typography sx={{textAlign: 'center', mt: 4, color: 'text.secondary'}}>
                            没有找到匹配的卡片。请尝试调整筛选条件。
                        </Typography>
                    </Grid>
                )}
            </Grid>

            {emergencyState && (
                <EmergencyDataDialog
                    open={true} // 如果存在 emergencyState，则强制打开
                    onClose={() => setEmergencyState(null)} // 关闭即退出紧急模式
                    onActionSuccess={handleActionSuccess}
                    emergencyState={emergencyState}
                />
            )}
        </div>
    );
};

export default HomePanel;