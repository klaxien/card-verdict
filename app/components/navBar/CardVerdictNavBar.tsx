import * as React from 'react';
import {AppBar, Toolbar, Typography, useScrollTrigger} from '@mui/material';
import styles from './CardVerdictNavBar.module.scss';

const CardVerdictNavBar = () => {
    const trigger = useScrollTrigger({
        disableHysteresis: true,
        threshold: 0
    });

    return (
        <React.Fragment>
            <AppBar color={'transparent'} elevation={0} sx={{
                backdropFilter: 'blur(30px)',
                backgroundColor: 'white',
                border: '1px solid #E8ECFC',
                borderStyle: trigger ? 'none none solid none' : 'none none none none',
            }}
                    variant={'outlined'}>
                <Toolbar>
                    <Typography variant="h6" component="div" className={styles.leftTitle}>
                        CardVerdict
                    </Typography>
                </Toolbar>
            </AppBar>
            <Toolbar />
        </React.Fragment>
    );
};

export default CardVerdictNavBar;
