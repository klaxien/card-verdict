import {
    isRouteErrorResponse,
    Links,
    Meta,
    Outlet,
    Scripts,
    ScrollRestoration,
} from "react-router";

import type {Route} from "./+types/root";
import "./app.css";
import CardVerdictNavBar from "~/components/navBar/CardVerdictNavBar";
import Grid from '@mui/material/Grid';

// MUI theme imports
import {ThemeProvider, createTheme} from '@mui/material/styles';
import InitColorSchemeScript from '@mui/material/InitColorSchemeScript';

import CssBaseline from '@mui/material/CssBaseline';

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
            <meta name="theme-color" media="(prefers-color-scheme: light)" content="#ffffff" />
            <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#0b1020" />
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
