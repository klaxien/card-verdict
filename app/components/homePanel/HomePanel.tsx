import React, {useEffect, useMemo, useState} from 'react';
import {
    Alert,
    Box,
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

// --- 类型定义 (保持不变) ---
type SortOrder = 'net-high-to-low' | 'net-low-to-high' | 'credits-high-to-low' | 'credits-low-to-high';

// --- 新增类型：用于紧急状态 ---
interface EmergencyState {
    message: string;
    corruptedBase64: string | null;
}

const HomePanel: React.FC = () => {
    // --- 核心数据状态 (保持不变) ---
    const [cardData, setCardData] = useState<cardverdict.v1.CreditCardDatabase | null>(null);
    const [userValuationDb, setUserValuationDb] = useState<userprofile.v1.IValuationProfile | null>(null);
    const [loading, setLoading] = useState(true);

    // --- 错误处理状态 (已修改) ---
    const [genericError, setGenericError] = useState<string | null>(null);
    const [isBackupDialogOpen, setIsBackupDialogOpen] = useState(false);
    const [emergencyState, setEmergencyState] = useState<EmergencyState | null>(null);

    // --- UI状态 (保持不变) ---
    const [sortOrder, setSortOrder] = useState<SortOrder>('net-high-to-low');

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
                    console.log({
                        message: err.message,
                        corruptedBase64: err.corruptedData,
                    });
                    // 设置紧急状态，这将强制打开恢复对话框
                    setEmergencyState({
                        message: err.message,
                        corruptedBase64: err.corruptedData,
                    });
                    setIsBackupDialogOpen(true);
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
    }, []); // 依赖数组为空，仅在组件挂载时运行一次

    const sortedCards = useMemo(() => {
        if (!cardData?.cards) return [];

        const cardsToSort = [...cardData.cards];

        const getUserValuation = (card: cardverdict.v1.ICreditCard, valuationDb: userprofile.v1.IValuationProfile | null) => {
            if (!valuationDb) return undefined;

            return valuationDb.cardValuations?.[card.cardId ?? ''];
        };
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
    }, [cardData?.cards, userValuationDb, sortOrder]);

    // --- 新增函数：用于处理对话框的关闭和成功操作 ---
    const handleDialogClose = () => {
        setIsBackupDialogOpen(false);
        // 注意：我们不清空 emergencyState，因为用户可能只是想暂时关闭对话框。
        // 如果再次打开，应保持紧急模式。
    };

    const handleActionSuccess = () => {
        // 在恢复或清除数据成功后，最可靠的方式是刷新整个应用
        window.location.reload();
    };


    if (loading) {
        // ... 加载UI保持不变 ...
        return <div className="flex justify-center items-center h-screen">...</div>;
    }

    if (genericError && !isBackupDialogOpen) {
        // 仅在没有打开备份对话框时显示通用错误，避免UI重叠
        return <div className="p-4"><Alert severity="error">{genericError}</Alert></div>;
    }

    return (
        <div className="p-4">
            {/* 排序和卡片网格的UI代码保持不变 */}
            <Box sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2}}>
                <Typography variant="h4" gutterBottom sx={{mb: 0}}>

                </Typography>
                <FormControl size="small" sx={{ m: 1, minWidth: 180}}>
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
                {sortedCards.map((card) => (
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
                ))}
            </Grid>

            {/* 它始终在DOM中，通过 `open` 属性控制显示 */}
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
