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
import {DataCorruptionError, loadActiveValuationProfile, saveValuationProfile,} from '~/client/userSettingsPersistence';
import {calculateNetWorth} from '~/utils/cardCalculations';
import EmergencyDataDialog from "~/components/dataManagement/EmergencyDataDialog";
import CardsFilterComponent from "~/components/homePanel/filter/CardsFilterComponent";
import SortOrder = userprofile.v1.ProfileSettings.SortOrder;
import FilterMode = userprofile.v1.ProfileSettings.FilterMode;

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
    // 状态现在直接使用 Protobuf 枚举
    const [sortOrder, setSortOrder] = useState<SortOrder>(SortOrder.NET_WORTH_HIGH_TO_LOW);
    const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(new Set());
    const [filterHasBeenApplied, setFilterHasBeenApplied] = useState(false);

    useEffect(() => {
        const fetchAllData = async () => {
            setLoading(true);
            let loadedDb: userprofile.v1.IValuationProfile | null = null;

            // --- 步骤1: 加载用户设置 ---
            try {
                loadedDb = loadActiveValuationProfile();
                setUserValuationDb(loadedDb);
            } catch (err) {
                if (err instanceof DataCorruptionError) {
                    console.error("Data corruption detected, entering emergency mode:", err);
                    setEmergencyState({message: err.message, corruptedBase64: err.corruptedData});
                } else {
                    // 对于其他非数据损坏的错误，显示通用错误信息并停止
                    const errorMessage = err instanceof Error ? err.message : '加载用户配置时发生未知错误';
                    setGenericError(errorMessage);
                    setLoading(false);
                    return;
                }
            }

            // --- 步骤2: 加载主卡片数据库 ---
            try {
                const data = await getCardDatabase();
                setCardData(data);

                // 步骤3: 应用保存的或默认的筛选/排序设置
                const settings = loadedDb?.settings;
                let initialSelection = new Set<string>();
                // 使用 proto 枚举，默认值为 PERSONAL_ONLY
                const filterMode = settings?.filterMode ?? FilterMode.PERSONAL_ONLY;

                const allCardIds = data.cards?.map(c => c.cardId).filter(Boolean) as string[] || [];

                switch (filterMode) {
                    case FilterMode.CUSTOM:
                        initialSelection = new Set(settings?.customSelectedCardIds || []);
                        break;
                    case FilterMode.ALL_CARDS:
                        initialSelection = new Set(allCardIds);
                        break;
                    case FilterMode.BUSINESS_ONLY:
                        data.cards?.forEach(card => {
                            if (card.cardId && card.cardType === cardverdict.v1.CardType.BUSINESS) {
                                initialSelection.add(card.cardId);
                            }
                        });
                        break;
                    case FilterMode.PERSONAL_ONLY:
                    case FilterMode.FILTER_MODE_UNSPECIFIED:
                    default:
                        data.cards?.forEach(card => {
                            if (card.cardId && card.cardType !== cardverdict.v1.CardType.BUSINESS) {
                                initialSelection.add(card.cardId);
                            }
                        });
                        break;
                }

                setSelectedCardIds(initialSelection);
                setSortOrder(settings?.sortOrder ?? SortOrder.NET_WORTH_HIGH_TO_LOW);
                setFilterHasBeenApplied(true);

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
        if (!cardData?.cards || !filterHasBeenApplied) return [];

        const cardsToDisplay = cardData.cards.filter(card => card.cardId && selectedCardIds.has(card.cardId));
        const cardsToSort = [...cardsToDisplay];

        // 排序逻辑
        const getUserValuation = (card: cardverdict.v1.ICreditCard, valuationDb: userprofile.v1.IValuationProfile | null) => valuationDb?.cardValuations?.[card.cardId ?? ''];
        cardsToSort.sort((a, b) => {
            const valA = calculateNetWorth(a, getUserValuation(a, userValuationDb));
            const valB = calculateNetWorth(b, getUserValuation(b, userValuationDb));

            switch (sortOrder) {
                case SortOrder.NET_WORTH_HIGH_TO_LOW:
                    return valB - valA;
                case SortOrder.NET_WORTH_LOW_TO_HIGH:
                    return valA - valB;
                case SortOrder.CREDITS_HIGH_TO_LOW:
                    return (b.credits?.length ?? 0) - (a.credits?.length ?? 0);
                case SortOrder.CREDITS_LOW_TO_HIGH:
                    return (a.credits?.length ?? 0) - (b.credits?.length ?? 0);
                default:
                    return 0;
            }
        });
        return cardsToSort;
    }, [cardData?.cards, userValuationDb, sortOrder, selectedCardIds, filterHasBeenApplied]);

    // 通用的保存设置函数，现在保存整个Profile
    const saveProfileSettings = (newSettings: Partial<userprofile.v1.IProfileSettings>) => {
        if (!userValuationDb) return;

        // 创建一个新的profile对象来更新，而不是直接修改state
        const updatedProfile: userprofile.v1.IValuationProfile = {
            ...userValuationDb,
            settings: {
                // 确保保留旧的设置
                ...userValuationDb.settings,
                ...newSettings,
            },
        };
        // 更新本地state以立即反映UI变化
        setUserValuationDb(updatedProfile);
        // 持久化整个更新后的profile
        saveValuationProfile(updatedProfile);
    };

    // 处理从筛选组件传来的新选择
    const handleApplyFilters = (mode: FilterMode, newSelectedIds: Set<string>) => {
        setSelectedCardIds(newSelectedIds);
        setFilterHasBeenApplied(true);

        const newFilterSettings: Partial<userprofile.v1.IProfileSettings> = {
            filterMode: mode,
            // 只有当模式是CUSTOM时，才保存ID列表
            customSelectedCardIds: mode === FilterMode.CUSTOM ? Array.from(newSelectedIds) : [],
        };
        saveProfileSettings(newFilterSettings);
    };

    // 处理排序变化
    const handleSortChange = (e: SelectChangeEvent<SortOrder>) => {
        const newSort = e.target.value as unknown as SortOrder;
        setSortOrder(newSort);
        saveProfileSettings({sortOrder: newSort});
    };

    // 紧急数据恢复成功后的操作
    const handleActionSuccess = () => {
        // 在恢复或清除数据成功后，最可靠的方式是刷新整个应用
        window.location.reload();
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
                        onChange={handleSortChange}
                    >
                        <MenuItem value={SortOrder.NET_WORTH_HIGH_TO_LOW}>净值 (从高到低)</MenuItem>
                        <MenuItem value={SortOrder.NET_WORTH_LOW_TO_HIGH}>净值 (从低到高)</MenuItem>
                        <MenuItem value={SortOrder.CREDITS_HIGH_TO_LOW}>coupon数 (从高到低)</MenuItem>
                        <MenuItem value={SortOrder.CREDITS_LOW_TO_HIGH}>coupon数 (从低到高)</MenuItem>
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
