import {Box, Card, CardContent, Divider, Grid, LinearProgress, Skeleton, Stack} from "@mui/material";
import type {Theme} from "@mui/material";

export function HydrateFallbackComponent() {
    const skeletonCardCount = 8;

    return (
        <Box role="status" aria-live="polite" sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
            <LinearProgress
                color="primary"
                sx={{
                    position: "fixed",
                    top: 0,
                    left: 0,
                    right: 0,
                    zIndex: (theme: Theme) => theme.zIndex.appBar + 1,
                }}
            />

            <Stack spacing={3} sx={{ pt: 1, pb: 4 }}>
                {/* 顶部工具区 */}
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 2 }}>
                    <Skeleton variant="text" width={220} height={40} />
                    <Skeleton variant="rounded" width={200} height={36} />
                </Stack>

                {/* 外层宽度容器与 App 保持一致 */}
                <Grid container display="flex" justifyContent="center" sx={{ paddingTop: '5em', paddingBottom: '0.5em' }}>
                    <Grid size={{ xs: 11, md: 10, xl: 9 }}>
                        {/* 卡片网格占位：断点与真实组件一致 */}
                        <Grid container spacing={3}>
                            {Array.from({ length: skeletonCardCount }).map((_, idx) => (
                                <Grid key={idx} size={{ xs: 12, sm: 6, md: 4, xl: 3 }}>
                                    <Card
                                        sx={{
                                            height: "100%",
                                            display: "flex",
                                            flexDirection: "column",
                                            boxShadow: 2,
                                            borderRadius: 4,
                                        }}
                                    >
                                        <CardContent sx={{ flexGrow: 1 }}>
                                            <Grid container spacing={2} alignItems="center" sx={{ flexWrap: "nowrap" }}>
                                                <Grid size="auto" sx={{ minWidth: 94.11, flexShrink: 0 }}>
                                                    <Skeleton
                                                        variant="rounded"
                                                        width={94.11}
                                                        height={59.77}
                                                        sx={{ borderRadius: 1, boxShadow: 2 }}
                                                    />
                                                </Grid>
                                                <Grid size="grow" sx={{ minWidth: 0, flexGrow: 1, overflow: "hidden" }}>
                                                    <Skeleton variant="text" width="100%" height={28} />
                                                    <Skeleton variant="text" width="75%" height={22} />
                                                </Grid>
                                            </Grid>

                                            <Grid container spacing={2} sx={{ my: 2, textAlign: "center" }}>
                                                <Grid size={{ xs: 6 }}>
                                                    <Skeleton variant="text" width={60} height={20} sx={{ mx: "auto" }} />
                                                    <Skeleton variant="text" width={80} height={28} sx={{ mx: "auto" }} />
                                                </Grid>
                                                <Grid size={{ xs: 6 }}>
                                                    <Skeleton variant="text" width={60} height={20} sx={{ mx: "auto" }} />
                                                    <Skeleton variant="text" width={80} height={28} sx={{ mx: "auto" }} />
                                                </Grid>
                                            </Grid>

                                            <Divider sx={{ mb: 2 }} />

                                            <Stack spacing={1}>
                                                {[...Array(4)].map((__, i) => (
                                                    <Box key={i}>
                                                        <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
                                                            <Skeleton variant="text" width="60%" height={20} />
                                                            <Skeleton variant="rounded" width={64} height={24} />
                                                        </Stack>
                                                        {i < 3 && <Divider sx={{ my: 1 }} />}
                                                    </Box>
                                                ))}
                                            </Stack>
                                        </CardContent>
                                    </Card>
                                </Grid>
                            ))}
                        </Grid>
                    </Grid>
                </Grid>
            </Stack>
        </Box>
    );
}
