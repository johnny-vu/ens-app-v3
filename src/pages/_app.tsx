import { RainbowKitProvider, Theme, getDefaultWallets, lightTheme } from '@rainbow-me/rainbowkit'
import '@rainbow-me/rainbowkit/styles.css'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NextPage } from 'next'
import type { AppProps } from 'next/app'
import { ReactElement, ReactNode } from 'react'
import { I18nextProvider } from 'react-i18next'
import { ThemeProvider, createGlobalStyle } from 'styled-components'
import { ChainProviderFn, WagmiConfig, configureChains, createClient } from 'wagmi'
import { goerli, localhost } from 'wagmi/chains'
import { infuraProvider } from 'wagmi/providers/infura'
import { jsonRpcProvider } from 'wagmi/providers/jsonRpc'

import { ThorinGlobalStyles, lightTheme as thorinLightTheme } from '@ensdomains/thorin'

import { Notifications } from '@app/components/Notifications'
import { TransactionStoreProvider } from '@app/hooks/transactions/TransactionStoreContext'
import { Basic } from '@app/layouts/Basic'
import { TransactionFlowProvider } from '@app/transaction-flow/TransactionFlowProvider'
import { BreakpointProvider } from '@app/utils/BreakpointProvider'
import { EnsProvider } from '@app/utils/EnsProvider'
import { SyncProvider } from '@app/utils/SyncProvider'
import { makePersistent } from '@app/utils/persist'

import i18n from '../i18n'
import '../styles.css'
import { setupAnalytics } from '../utils/analytics'

const rainbowKitTheme: Theme = {
  ...lightTheme({
    accentColor: thorinLightTheme.colors.accent,
    borderRadius: 'medium',
  }),
  fonts: {
    body: 'Satoshi, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Oxygen, Ubuntu, Cantarell, Fira Sans, Droid Sans, Helvetica Neue, sans-serif',
  },
}

const GlobalStyle = createGlobalStyle`
  html,
  body {
    padding: 0;
    margin: 0;
  }

  *,
  ::before,
  ::after {
    font-family: Satoshi,
      -apple-system,
      BlinkMacSystemFont,
      "Segoe UI",
      Roboto,
      Oxygen,
      Ubuntu,
      Cantarell,
      "Fira Sans",
      "Droid Sans",
      "Helvetica Neue",
      sans-serif;
  }

  body {
    background: radial-gradient(50% 50% at 50% 50%, rgba(82, 152, 255, 0.062) 0%, rgba(255, 255, 255, 0) 100%), #F7F7F7;
  }

  body, .min-safe {
    min-height: 100vh;
    /* stylelint-disable-next-line value-no-vendor-prefix */
    @supports (-webkit-touch-callout: none) {
      /* stylelint-disable-next-line value-no-vendor-prefix */
      min-height: -webkit-fill-available;
    }
  }

  a {
    color: inherit;
    text-decoration: none;
  }

  * {
    box-sizing: border-box;
    font-feature-settings: "ss01" on, "ss03" on;
    /* stylelint-disable-next-line property-no-vendor-prefix */
    -moz-font-feature-settings: "ss01" on, "ss03" on;
  }
`

const breakpoints = {
  xs: '(min-width: 360px)',
  sm: '(min-width: 640px)',
  md: '(min-width: 768px)',
  lg: '(min-width: 1024px)',
  xl: '(min-width: 1280px)',
}

const providerArray: ChainProviderFn<typeof goerli | typeof localhost>[] = []

if (process.env.NEXT_PUBLIC_PROVIDER) {
  // for local testing
  providerArray.push(
    jsonRpcProvider({
      rpc: () => ({ http: process.env.NEXT_PUBLIC_PROVIDER! }),
    }),
  )
} else {
  if (!process.env.NEXT_PUBLIC_IPFS) {
    // only use infura if we are not using IPFS
    // since we don't want to allow all domains to access infura
    providerArray.push(infuraProvider({ apiKey: 'cfa6ae2501cc4354a74e20432507317c' }))
  }
  // fallback cloudflare gateway if infura is down or for IPFS
  providerArray.push(
    jsonRpcProvider({
      rpc: (c) => ({
        http: `https://web3.ens.domains/v1/${c.network === 'homestead' ? 'mainnet' : c.network}`,
      }),
    }),
  )
}

const { provider, chains } = configureChains([goerli, localhost], providerArray)

setupAnalytics()

const { connectors } = getDefaultWallets({
  appName: 'ENS',
  chains,
})

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
})

const wagmiClient = createClient({
  autoConnect: true,
  connectors,
  provider,
  queryClient,
  persister: null,
})

makePersistent(queryClient)

type NextPageWithLayout = NextPage & {
  getLayout?: (page: ReactElement) => ReactNode
}

type AppPropsWithLayout = AppProps & {
  Component: NextPageWithLayout
}

function MyApp({ Component, pageProps }: AppPropsWithLayout) {
  const getLayout = Component.getLayout ?? ((page) => page)

  return (
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <WagmiConfig client={wagmiClient}>
          <RainbowKitProvider theme={rainbowKitTheme} chains={chains}>
            <TransactionStoreProvider>
              <EnsProvider>
                <ThemeProvider theme={thorinLightTheme}>
                  <BreakpointProvider queries={breakpoints}>
                    <GlobalStyle />
                    <ThorinGlobalStyles />
                    <SyncProvider>
                      <TransactionFlowProvider>
                        <Notifications />
                        <Basic>{getLayout(<Component {...pageProps} />)}</Basic>
                      </TransactionFlowProvider>
                    </SyncProvider>
                  </BreakpointProvider>
                </ThemeProvider>
              </EnsProvider>
            </TransactionStoreProvider>
          </RainbowKitProvider>
        </WagmiConfig>
      </I18nextProvider>
    </QueryClientProvider>
  )
}

export default MyApp
