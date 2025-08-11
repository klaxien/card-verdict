import * as React from 'react';
import {
    Alert,
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    Divider,
    Typography,
} from '@mui/material';
import Long from 'long';
import {google, userprofile} from '~/generated/bundle';
import {
    clearAllData,
    getBackupData,
    loadActiveValuationProfile,
    restoreDataFromJson,
} from '~/client/userSettingsPersistence';

/**
 * 格式化 Protobuf Timestamp 对象为可读的本地化日期时间字符串。
 * 此函数能正确处理 jspb 可能生成的 Long 类型。
 * @param timestamp Protobuf Timestamp 接口对象
 * @returns 格式化的日期时间字符串, e.g., "2023/10/27, 10:30:00 AM"
 */
function formatTimestamp(timestamp: google.protobuf.ITimestamp | null | undefined): string {
    if (!timestamp || !timestamp.seconds) {
        return '未知';
    }
    // 关键：检查 seconds 是否是 Long 的实例，如果是则转换为 number
    const seconds = (timestamp.seconds instanceof Long)
        ? timestamp.seconds.toNumber()
        : timestamp.seconds;

    if (typeof seconds !== 'number') {
        return '无效日期';
    }

    return new Date(seconds * 1000).toLocaleString();
}

interface BackupRestoreDialogProps {
    open: boolean;
    onClose: () => void;
    // 此回调用于在恢复或清除数据成功后，通知父组件刷新应用
    onRestoreSuccess: () => void;
}

const BackupRestoreDialog: React.FC<BackupRestoreDialogProps> = ({open, onClose, onRestoreSuccess}) => {
    // UI 状态
    const [activeProfile, setActiveProfile] = React.useState<userprofile.v1.IValuationProfile | null>(null);
    const [feedback, setFeedback] = React.useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [confirmClearOpen, setConfirmClearOpen] = React.useState(false);

    // 用于触发文件选择框的引用
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    // 当对话框打开时，加载当前数据信息并重置反馈
    React.useEffect(() => {
        if (open) {
            setActiveProfile(loadActiveValuationProfile());
            setFeedback(null);
        }
    }, [open]);

    // --- 备份逻辑 ---
    const handleBackup = () => {
        const backup = getBackupData(); // 调用数据层函数

        if (!backup) {
            setFeedback({type: 'error', message: '没有找到可备份的数据或数据已损坏。'});
            return;
        }

        const blob = new Blob([backup.content], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = backup.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        setFeedback({type: 'success', message: 'JSON 备份文件已开始下载。'});
    };

    // --- 恢复逻辑 ---
    const handleRestoreClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target?.result as string;
            const result = restoreDataFromJson(content); // 调用数据层函数

            if (result.success) {
                setFeedback({type: 'success', message: '数据恢复成功！应用即将刷新。'});
                setTimeout(onRestoreSuccess, 1500);
            } else {
                setFeedback({type: 'error', message: `恢复失败: ${result.error}`});
            }
        };

        reader.onerror = () => {
            setFeedback({type: 'error', message: '读取文件失败。'});
        };

        reader.readAsText(file);
        event.target.value = ''; // 允许再次选择同一个文件
    };

    // --- 清空数据逻辑 ---
    const handleOpenClearConfirm = () => {
        setConfirmClearOpen(true);
    };

    const handleCloseClearConfirm = () => {
        setConfirmClearOpen(false);
    };

    const handleConfirmClear = () => {
        clearAllData(); // 调用数据层函数
        handleCloseClearConfirm();
        setFeedback({type: 'success', message: '所有数据已成功清除。应用即将刷新。'});
        setTimeout(onRestoreSuccess, 1500);
    };

    return (
        <React.Fragment>
            <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
                <DialogTitle>备份、恢复与重置</DialogTitle>
                {feedback && <Alert severity={feedback.type} sx={{mb: 2}}>{feedback.message}</Alert>}

                <DialogContent>


                    {/* 当前数据状态区域 */}
                    <Box sx={{mb: 2}}>
                        <Typography variant="h6" gutterBottom>当前数据状态</Typography>
                        {activeProfile ? (
                            <>
                                <Typography variant="body2"
                                            color="text.secondary">创建于: {formatTimestamp(activeProfile.createdAt)}</Typography>
                                <Typography variant="body2"
                                            color="text.secondary">上次修改于: {formatTimestamp(activeProfile.updatedAt)}</Typography>
                            </>
                        ) : (
                            <Typography variant="body2" color="text.secondary">当前无数据。</Typography>
                        )}
                    </Box>

                    <Divider sx={{my: 2}}/>

                    {/* 备份区域 */}
                    <Box sx={{mb: 2}}>
                        <Typography variant="h6" gutterBottom>备份数据</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{mb: 1.5}}>
                            将您的所有配置打包成一个 <code>.json</code> 文件用于恢复数据。
                        </Typography>
                        <Button variant="contained" onClick={handleBackup} disabled={!activeProfile}>下载 .json
                            备份文件</Button>
                    </Box>

                    <Divider sx={{my: 2}}/>

                    {/* 恢复区域 */}
                    <Box>
                        <Typography variant="h6" gutterBottom>恢复数据</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{mb: 1.5}}>
                            请选择您之前下载的 <code>.json</code> 备份文件进行恢复。
                            <br/><strong>注意：这将覆盖您当前的所有数据。</strong>
                        </Typography>
                        <Button variant="outlined" color="primary" onClick={handleRestoreClick}>选择 .json
                            文件恢复</Button>
                        <input type="file" ref={fileInputRef} onChange={handleFileSelect} style={{display: 'none'}}
                               accept="application/json,.json"/>
                    </Box>

                    <Divider sx={{my: 2}}/>


                    <Box>
                        <Typography variant="h6" gutterBottom color="error">
                            清空数据
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{mb: 1.5}}>
                            此操作会永久删除您的所有本地数据且无法恢复。请在操作前确保您已有备份。
                        </Typography>
                        <Button
                            variant="outlined"
                            color="error"
                            onClick={handleOpenClearConfirm}
                            disabled={!activeProfile}
                        >
                            {!!activeProfile ? '清空所有数据' : '当前无数据'}
                        </Button>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={onClose}>关闭</Button>
                </DialogActions>
            </Dialog>


            <Dialog
                open={confirmClearOpen}
                onClose={handleCloseClearConfirm}
                aria-labelledby="alert-dialog-title"
                aria-describedby="alert-dialog-description"
            >
                <DialogTitle id="alert-dialog-title" color="error">
                    {"确认清空所有数据？"}
                </DialogTitle>
                <DialogContent>
                    <DialogContentText id="alert-dialog-description">
                        此操作不可逆！所有本地自定义数据（如估值）都将被永久删除。
                        <br/>
                        <strong>您确定要继续吗？</strong>
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseClearConfirm}>取消</Button>
                    <Button onClick={handleConfirmClear} color="error" autoFocus>
                        确认清空
                    </Button>
                </DialogActions>
            </Dialog>
        </React.Fragment>
    );
};

export default BackupRestoreDialog;
