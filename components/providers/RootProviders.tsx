"use client";

import { ThemeProvider } from 'next-themes';
import React, { ReactNode, useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

function RootProviders({ children }: { children: ReactNode }) {
    const [queryClient] = React.useState(() => new QueryClient({}));
    const [mounted, setMounted] = useState(false);

    // Prevent hydration mismatch by waiting until client-side
    useEffect(() => {
        setMounted(true);
    }, []);

    return (
        <QueryClientProvider client={queryClient}>
            {mounted ? (
                <ThemeProvider
                    attribute="class"
                    defaultTheme='dark'
                    enableSystem
                    disableTransitionOnChange
                >
                    {children}
                </ThemeProvider>
            ) : (
                // Render without theme provider during SSR
                <>{children}</>
            )}
            <ReactQueryDevtools initialIsOpen={false} />
        </QueryClientProvider>
    )
}

export default RootProviders