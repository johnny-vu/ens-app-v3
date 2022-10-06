import { useDisconnect } from '@web3modal/react'
import { useTranslation } from 'react-i18next'

import { Button } from '@ensdomains/thorin'

import { SectionContainer } from './Section'

export const WalletSection = () => {
  const { t: tc } = useTranslation()
  const { t } = useTranslation('settings')

  const disconnect = useDisconnect()

  return (
    <SectionContainer
      title={t('section.wallet.title')}
      action={
        <Button
          data-testid="wallet-section-disconnect"
          size="small"
          tone="red"
          variant="secondary"
          shadowless
          onClick={() => disconnect()}
        >
          {tc('wallet.disconnect')}
        </Button>
      }
      fill
    >
      {null}
    </SectionContainer>
  )
}
