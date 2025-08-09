import type { Config } from "@react-router/dev/config";

export default {
    // 切换到 SPA 模式，GitHub Pages 不支持 SSR
    ssr: false,
    basename: '/card-verdict/',
} satisfies Config;
