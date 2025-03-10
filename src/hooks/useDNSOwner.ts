import { useQuery } from 'wagmi'

import { useEns } from '@app/utils/EnsProvider'

const useDNSOwner = (name: string, valid: boolean | undefined) => {
  const { ready, getDNSOwner } = useEns()

  const {
    data: dnsOwner,
    status,
    isFetched,
    isLoading,
    isFetchedAfterMount,
    // don't remove this line, it updates the isCachedData state (for some reason) but isn't needed to verify it
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    isFetching,
  } = useQuery(['getDNSOwner', name], () => getDNSOwner(name), {
    enabled: ready && valid && !name?.endsWith('.eth'),
  })

  const isCachedData = status === 'success' && isFetched && !isFetchedAfterMount

  return {
    dnsOwner,
    isCachedData,
    isLoading,
  }
}

export default useDNSOwner
