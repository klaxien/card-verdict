import React, {useState} from 'react';
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
import {clearAllData, restoreDataFromJson} from "~/client/userSettingsPersistence";

// 定义 props 接口
interface EmergencyState {
    message: string;
    corruptedBase64: string | null;
}

interface EmergencyDataDialogProps {
    open: boolean;
    onClose: () => void;
    onActionSuccess: () => void;
    emergencyState: EmergencyState;
}

const EmergencyDataDialog: React.FC<EmergencyDataDialogProps> = ({open, onClose, onActionSuccess, emergencyState}) => {
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    // --- 下载并清除的核心逻辑 ---
    const handleDownloadAndClear = () => {
        if (!emergencyState.corruptedBase64) {
            setFeedback({type: 'error', message: '无法找到可下载的损坏数据。'});
            return;
        }

        // 1. 即时生成紧急备份对象并触发下载
        const backupObject = {
            metadata: {
                fileFormatVersion: "1.0-corrupted",
                appName: "CardVerdict",
                exportDate: new Date().toISOString()
            },
            readableData: null,
            backupData: emergencyState.corruptedBase64,
        };
        const blob = new Blob([JSON.stringify(backupObject, null, 2)], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `card-verdict-EMERGENCY-backup.json`;
        a.click();
        URL.revokeObjectURL(url);

        // 2. 清除本地数据
        clearAllData();

        // 3. 通知成功并准备刷新
        setConfirmOpen(false);
        setFeedback({type: 'success', message: '紧急备份已下载，本地数据已清除。应用即将刷新。'});
        setTimeout(onActionSuccess, 2000);
    };

    // --- 恢复逻辑 (与之前类似) ---
    const handleRestoreClick = () => fileInputRef.current?.click();
    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target?.result as string;
            const result = restoreDataFromJson(content);
            if (result.success) {
                setFeedback({type: 'success', message: '数据恢复成功！应用即将刷新。'});
                setTimeout(onActionSuccess, 1500);
            } else {
                setFeedback({type: 'error', message: `恢复失败: ${result.error}`});
            }
        };
        reader.onerror = () => {
            setFeedback({type: 'error', message: '读取文件失败。'});
        };
        reader.readAsText(file);
        event.target.value = '';
    };

    return (
        <React.Fragment>
            <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" disableEscapeKeyDown>
                <DialogTitle color="error">数据已损坏</DialogTitle>
                <DialogContent>
                    <Alert severity="error" sx={{mb: 2}}>
                        <strong>检测到严重错误:</strong> {emergencyState.message}
                    </Alert>
                    <Typography variant="body2" color="text.secondary" sx={{mb: 2}}>
                        您的本地数据已无法读取。请从下方选择一个操作来解决问题。
                    </Typography>

                    <Divider sx={{my: 2, borderColor: 'error.light'}}/>

                    {/* 选项1: 从之前的备份恢复 */}
                    <Box sx={{mb: 3}}>
                        <Typography variant="h6" gutterBottom>选项一：恢复数据 (推荐)</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{mb: 1.5}}>
                            如果您有之前下载的有效备份文件 (<code>.json</code>)，您可以立即恢复。
                        </Typography>
                        <Button variant="contained" color="primary" onClick={handleRestoreClick}>从备份文件恢复</Button>
                        <input type="file" ref={fileInputRef} onChange={handleFileSelect} style={{display: 'none'}}
                               accept=".json"/>
                    </Box>

                    {/* 选项2: 下载残余数据并清空 */}
                    <Box>
                        <Typography variant="h6" gutterBottom>选项二：重置系统</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{mb: 1.5}}>
                            此操作会先将已损坏的原始数据下载到本地（用于开发者分析或手动修复），然后彻底清空本地所有数据，让您可以重新开始。
                        </Typography>
                        <Button variant="outlined" color="error" onClick={() => setConfirmOpen(true)}>
                            下载紧急备份，然后清除数据
                        </Button>
                    </Box>
                    {feedback && <Alert severity={feedback.type} sx={{mt: 2}}>{feedback.message}</Alert>}
                </DialogContent>
            </Dialog>

            {/* 二次确认对话框 */}
            <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
                <DialogTitle color="error">请再次确认</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        您确定要下载损坏数据的备份，并永久删除所有本地数据吗？此操作不可逆。
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setConfirmOpen(false)}>取消</Button>
                    <Button onClick={handleDownloadAndClear} color="error" autoFocus>确认并继续</Button>
                </DialogActions>
            </Dialog>
        </React.Fragment>
    );
};

export default EmergencyDataDialog;
