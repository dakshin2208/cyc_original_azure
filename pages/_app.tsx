import type { AppProps } from 'next/app'
import { ThemeProvider } from "@/components/theme-provider"
import { Providers } from "../app/providers"

export default function App({ Component, pageProps }: AppProps) {
  return (
    <Providers>
      <ThemeProvider attribute="class" defaultTheme="light">
        <Component {...pageProps} />
      </ThemeProvider>
    </Providers>
  )
} 