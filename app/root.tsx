import {isRouteErrorResponse, Links, Meta, Outlet, Scripts, ScrollRestoration,} from "react-router";

import type {Route} from "./+types/root";
import "./app.css";
import CardVerdictNavBar from "~/components/navBar/CardVerdictNavBar";
import Grid from '@mui/material/Grid';

// MUI theme imports
import {createTheme, ThemeProvider} from '@mui/material/styles';
import InitColorSchemeScript from '@mui/material/InitColorSchemeScript';

import CssBaseline from '@mui/material/CssBaseline';
import {HydrateFallbackComponent} from "~/components/common/HydrateComponent";

export const links: Route.LinksFunction = () => [
    {rel: "preconnect", href: "https://fonts.googleapis.com"},
    {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
    },
    {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
    },
];

export function HydrateFallback() {
    return HydrateFallbackComponent();
}


export function Layout({children}: { children: React.ReactNode }) {
    // Read the scheme set by InitColorSchemeScript so client render matches the DOM
    const htmlColorScheme =
        typeof document !== "undefined"
            ? document.documentElement.getAttribute("data-mui-color-scheme") ?? undefined
            : undefined;

    return (
        <html
            lang="en"
            data-mui-color-scheme={htmlColorScheme}
        >
        <head>
            {/* Ensure this runs before hydration to avoid flash and set the attribute */}
            <InitColorSchemeScript defaultMode="system"/>
            <meta charSet="utf-8"/>
            <meta name="viewport" content="width=device-width, initial-scale=1"/>
            <Meta/>
            <Links/>
            <link rel="apple-touch-icon" sizes="180x180"
                  href={`${import.meta.env.BASE_URL}favicons/apple-touch-icon.png`}/>
            <link rel="icon" type="image/png" sizes="32x32"
                  href={`${import.meta.env.BASE_URL}favicons/favicon-32x32.png`}/>
            <link rel="icon" type="image/png" sizes="16x16"
                  href={`${import.meta.env.BASE_URL}favicons/favicon-16x16.png`}/>
            <link rel="shortcut icon" href={`${import.meta.env.BASE_URL}favicons/favicon.ico`}/>
            <link rel="manifest" href={`${import.meta.env.BASE_URL}favicons/site.webmanifest`}/>
            <meta name="theme-color" media="(prefers-color-scheme: light)" content="#ffffff"/>
            <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#0b1020"/>
        </head>
        <body>
        {children}
        <ScrollRestoration/>
        <Scripts/>
        </body>
        </html>
    );
}

// Create a theme that supports light + dark via colorSchemes
const theme = createTheme({
    cssVariables: true,        // use CSS variables for proper dark-mode handling
    colorSchemes: {
        dark: true,
        light: true,
    },
    typography: {
        fontFamily: [
            '"Roboto"',                  // 主英文字体
            '"Helvetica"',               // Mac 备用英文
            '"Arial"',                   // 通用英文 fallback

            // 中文优先按简→繁
            '"PingFang SC"',              // macOS 简体中文
            '"Microsoft YaHei"',          // Windows 简体中文
            '"Noto Sans CJK SC"',         // Linux/跨平台 简体
            '"Noto Sans CJK TC"',         // 繁体中文
            '"WenQuanYi Micro Hei"',      // 旧 Linux 中文

            // 日语（防止 Accept-Language=ja 时 fallback 不一致）
            '"Noto Sans JP"',             // Linux/Mac 日语
            '"Hiragino Kaku Gothic ProN"',// macOS 日语

            // Emoji（不同系统彩色支持）
            '"Apple Color Emoji"',        // macOS
            '"Segoe UI Emoji"',           // Windows
            '"Noto Color Emoji"',         // Linux

            'sans-serif'                  // 最终兜底
        ].join(','),
    },
});

export default function App() {
    return (
        <ThemeProvider
            theme={theme}
            defaultMode="system"               // 跟随系统
            disableTransitionOnChange          // 切换时不闪烁
            noSsr                              // SPA 可开启以避免双渲染导致的闪烁
        >
            <CssBaseline/>
            <CardVerdictNavBar/>
            <Grid container display="flex" justifyContent="center" sx={{paddingTop: '2em', paddingBottom: '2em'}}>
                <Grid size={{xs: 11, md: 10, xl: 9}}>
                    <Outlet/>
                </Grid>
            </Grid>
        </ThemeProvider>
    );
}

export function ErrorBoundary({error}: Route.ErrorBoundaryProps) {
    let message = "Oops!";
    let details = "An unexpected error occurred.";
    let stack: string | undefined;

    if (isRouteErrorResponse(error)) {
        message = error.status === 404 ? "404" : "Error";
        details =
            error.status === 404
                ? "The requested page could not be found."
                : error.statusText || details;
    } else if (import.meta.env.DEV && error && error instanceof Error) {
        details = error.message;
        stack = error.stack;
    }

    return (
        <main className="pt-16 p-4 container mx-auto">
            <h1>{message}</h1>
            <p>{details}</p>
            {stack && (
                <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
            )}
        </main>
    );
}
