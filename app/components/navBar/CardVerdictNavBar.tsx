import * as React from 'react';
import {AppBar, Box, IconButton, Menu, MenuItem, Toolbar, Typography, useScrollTrigger} from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import styles from './CardVerdictNavBar.module.scss';
import BackupRestoreDialog from "~/components/dataManagement/BackupRestoreDialog";

const CardVerdictNavBar = () => {
    const trigger = useScrollTrigger({
        disableHysteresis: true,
        threshold: 0
    });

    const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
    const [dialogOpen, setDialogOpen] = React.useState(false);
    const menuOpen = Boolean(anchorEl);

    const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
    };

    const handleBackupRestoreClick = () => {
        setDialogOpen(true);
        handleMenuClose();
    };

    const handleDialogClose = () => {
        setDialogOpen(false);
    };

    const handleRestoreSuccess = () => {
        // 最简单可靠的方式是刷新页面来加载恢复后的新数据
        window.location.reload();
    };

    return (
        <React.Fragment>
            <AppBar
                color="transparent"
                elevation={0}
                sx={{
                    backdropFilter: 'blur(30px)',
                    backgroundColor: 'var(--mui-palette-background-paper)',
                    borderColor: 'var(--mui-palette-divider)',
                    borderWidth: 1,
                    borderStyle: trigger ? 'none none solid none' : 'none',
                }}
                variant="outlined"
            >
                <Toolbar>
                    <Typography variant="h6" component="div" className={styles.leftTitle}>
                        CardVerdict
                    </Typography>
                    <Box sx={{flexGrow: 1}}/> {/* 这个Box组件会将右侧的图标推到最右边 */}
                    <IconButton
                        aria-label="更多选项"
                        id="long-button"
                        aria-controls={menuOpen ? 'long-menu' : undefined}
                        aria-expanded={menuOpen ? 'true' : undefined}
                        aria-haspopup="true"
                        onClick={handleMenuClick}
                    >
                        <MoreVertIcon/>
                    </IconButton>
                    <Menu
                        id="long-menu"
                        MenuListProps={{
                            'aria-labelledby': 'long-button',
                        }}
                        anchorEl={anchorEl}
                        open={menuOpen}
                        onClose={handleMenuClose}
                    >
                        <MenuItem onClick={handleBackupRestoreClick}>
                            数据管理
                        </MenuItem>
                    </Menu>
                </Toolbar>
            </AppBar>
            <Toolbar />
            <BackupRestoreDialog open={dialogOpen}
                                 onClose={handleDialogClose}
                                 onRestoreSuccess={handleRestoreSuccess}/>
        </React.Fragment>
    );
};

export default CardVerdictNavBar;