/* eslint-disable jsx-a11y/click-events-have-key-events */

/* eslint-disable jsx-a11y/no-static-element-interactions */

/* eslint-disable jsx-a11y/interactive-supports-focus */
import { useQueryClient } from '@tanstack/react-query'
import debounce from 'lodash/debounce'
import { RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import useTransition, { TransitionState } from 'react-transition-state'
import styled, { css } from 'styled-components'

import { parseInputType, validateName } from '@ensdomains/ensjs/utils/validation'
import { BackdropSurface, Portal, Typography, mq } from '@ensdomains/thorin'

import { useLocalStorage } from '@app/hooks/useLocalStorage'
import { useRouterWithHistory } from '@app/hooks/useRouterWithHistory'
import { useElementSize } from '@app/hooks/useWindowSize'
import { useBreakpoint } from '@app/utils/BreakpointProvider'
import { getRegistrationStatus } from '@app/utils/registrationStatus'

import { FakeSearchInputBox, SearchInputBox } from './SearchInputBox'
import { SearchResult } from './SearchResult'
import { AnyItem, HistoryItem, SearchItem } from './types'

const Container = styled.div<{ $size: 'medium' | 'extraLarge' }>(
  ({ $size }) => css`
    width: 100%;
    position: relative;
    ${$size === 'extraLarge' &&
    mq.sm.min(css`
      padding-left: 48px;
      padding-right: 48px;
    `)}
  `,
)

const SearchResultsContainer = styled.div<{
  $state: TransitionState
  $error?: boolean
}>(
  ({ theme, $state, $error }) => css`
    position: absolute;
    width: 100%;
    height: min-content;
    top: calc(100% + ${theme.space['3']});

    background-color: #f7f7f7;
    box-shadow: 0 2px 12px ${theme.colors.border};
    border-radius: ${theme.radii.extraLarge};
    border: ${theme.borderWidths.px} ${theme.borderStyles.solid}
      ${$error ? theme.colors.red : theme.colors.border};

    overflow: hidden;

    opacity: 0;
    z-index: 1000;
    transform: translateY(-${theme.space['2']});
    transition: 0.35s all cubic-bezier(1, 0, 0.22, 1.6), 0s border-color linear 0s,
      0s width linear 0s;

    ${$state === 'entered'
      ? css`
          opacity: 1;
          transform: translateY(0px);
        `
      : css`
          & > div {
            cursor: default;
          }
        `}
  `,
)

const FloatingSearchContainer = styled.div<{ $state: TransitionState }>(
  ({ theme, $state }) => css`
    width: 95%;

    position: fixed;
    left: 2.5%;
    z-index: 9999;
    top: ${theme.space['4']};

    display: flex;
    flex-direction: column;

    opacity: 0;

    & > div:nth-child(2) {
      width: 95vw !important;
    }

    ${$state === 'entered' &&
    css`
      opacity: 1;
    `}
  `,
)

const InputAndCancel = styled.div(
  () => css`
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
  `,
)

const CancelButton = styled(Typography)(
  ({ theme }) => css`
    padding: ${theme.space['3']};
  `,
)

const debouncer = debounce((setFunc: () => void) => setFunc(), 500)

const MobileSearchInput = ({
  state,
  toggle,
  searchInputRef,
  SearchResultsElement,
  SearchInputElement,
}: {
  state: TransitionState
  toggle: (value: boolean) => void
  searchInputRef: RefObject<HTMLInputElement>
  SearchResultsElement: JSX.Element
  SearchInputElement: JSX.Element
}) => {
  const { t } = useTranslation('common')

  useEffect(() => {
    if (state === 'entered') {
      searchInputRef.current?.focus()
    }
  }, [searchInputRef, state])

  return (
    <>
      <FakeSearchInputBox
        onClick={(e) => {
          toggle(true)
          // MOBILE SAFARI FIX:
          // focus on the fake input first, then wait for the transition to finish and focus on the real input
          // this allows the keyboard to pop up
          e.currentTarget.focus()
          e.preventDefault()
          setTimeout(() => searchInputRef.current?.focus(), 350)
        }}
      />
      {state !== 'unmounted' && (
        <Portal>
          <BackdropSurface
            $empty={false}
            onClick={() => toggle(false)}
            $state={state}
            data-testid="search-input-backdrop"
          />
          <FloatingSearchContainer $state={state}>
            <InputAndCancel>
              {SearchInputElement}
              <CancelButton as="button" onClick={() => toggle(false)}>
                {t('action.cancel')}
              </CancelButton>
            </InputAndCancel>
            {SearchResultsElement}
          </FloatingSearchContainer>
        </Portal>
      )}
    </>
  )
}

export const SearchInput = ({
  size = 'extraLarge',
  setSearchState,
}: {
  size?: 'medium' | 'extraLarge'
  setSearchState?: (value: TransitionState) => void
}) => {
  const { t } = useTranslation('common')
  const router = useRouterWithHistory()
  const breakpoints = useBreakpoint()
  const queryClient = useQueryClient()

  const [inputVal, setInputVal] = useState('')

  const [state, toggle] = useTransition({
    enter: true,
    exit: true,
    preEnter: true,
    preExit: true,
    mountOnEnter: true,
    unmountOnExit: true,
    timeout: {
      enter: 0,
      exit: 350,
    },
  })

  const searchInputRef = useRef<HTMLInputElement>(null)
  const searchInputContainerRef = useRef<HTMLDivElement>(null)
  const { width } = useElementSize(searchInputContainerRef.current)

  const [selected, setSelected] = useState(0)
  const [usingPlaceholder, setUsingPlaceholder] = useState(false)

  const [history, setHistory] = useLocalStorage<HistoryItem[]>('search-history', [])

  const [normalisedName, isValid, inputType, isEmpty, isTLD, hasNormalisedValue] = useMemo(() => {
    if (inputVal) {
      let _normalisedName: string
      let _inputType: any
      let _isValid = true
      try {
        _normalisedName = validateName(inputVal.replace(/ /g, ''))
        _inputType = parseInputType(_normalisedName)
      } catch (e) {
        _normalisedName = ''
        _isValid = false
        _inputType = {
          type: 'unknown',
          info: 'unsupported',
        }
      }

      return [
        _normalisedName,
        _isValid &&
          _inputType.type !== 'unknown' &&
          _inputType.info !== 'unsupported' &&
          _inputType.info !== 'short',
        _inputType,
        false,
        !_normalisedName.includes('.'),
        !!_normalisedName,
      ]
    }
    return ['', true, { type: 'name', info: 'supported' }, true, false]
  }, [inputVal])

  const searchItem: SearchItem = useMemo(() => {
    if (isEmpty) {
      return {
        type: 'text',
        value: t('search.emptyText'),
      }
    }
    if (!isValid) {
      if (inputType.info === 'short') {
        return {
          type: 'error',
          value: t('search.errors.tooShort'),
        }
      }
      if (!hasNormalisedValue) {
        return {
          type: 'error',
          value: t('search.errors.invalid'),
        }
      }
    }
    if (inputType.type === 'address') {
      return {
        type: 'address',
      }
    }
    if (isTLD) {
      return {
        type: 'nameWithDotEth',
      }
    }
    return {
      type: 'name',
    }
  }, [isEmpty, isValid, inputType.type, inputType.info, isTLD, t, hasNormalisedValue])

  const extraItems = useMemo(() => {
    if (history.length > 0) {
      let historyRef = history
      if (normalisedName !== '') {
        historyRef = history.filter(
          (item) =>
            item.value !== normalisedName &&
            item.value.includes(normalisedName) &&
            (searchItem.type === 'nameWithDotEth' ? item.value !== `${normalisedName}.eth` : true),
        )
      }
      return historyRef
        .sort((a, b) => b.lastAccessed - a.lastAccessed)
        .map((item) => ({ ...item, isHistory: true }))
    }
    return []
  }, [normalisedName, searchItem.type, history])

  const searchItems: AnyItem[] = useMemo(() => {
    const _searchItem = { ...searchItem, isHistory: false }
    const _extraItems = extraItems
    if (searchItem.type === 'error') {
      return [_searchItem]
    }
    if (searchItem.type === 'text') {
      if (extraItems.length > 0) {
        return [..._extraItems.slice(0, 5)]
      }
      return [_searchItem]
    }
    const _searchItems: AnyItem[] =
      _searchItem.type === 'nameWithDotEth'
        ? [_searchItem, { type: 'name', isHistory: false }]
        : [_searchItem]
    return [..._searchItems, ...extraItems].slice(0, 5)
  }, [searchItem, extraItems])

  const handleFocusIn = useCallback(() => toggle(true), [toggle])
  const handleFocusOut = useCallback(() => toggle(false), [toggle])

  const handleSearch = useCallback(() => {
    let selectedItem = searchItems[selected] as SearchItem
    if (!selectedItem) return
    if (selectedItem.type === 'error' || selectedItem.type === 'text') return
    if (selectedItem.type === 'nameWithDotEth') {
      selectedItem = {
        type: 'name',
        value: `${normalisedName}.eth`,
      }
    }
    if (!selectedItem.value) {
      selectedItem.value = normalisedName
    }
    if (selectedItem.type === 'name') {
      const labels = selectedItem.value.split('.')
      const isDotETH = labels.length === 2 && labels[1] === 'eth'
      if (isDotETH && labels[0].length < 3) {
        return
      }
    }
    let path =
      selectedItem.type === 'address'
        ? `/address/${selectedItem.value}`
        : `/profile/${selectedItem.value}`
    if (selectedItem.type === 'nameWithDotEth' || selectedItem.type === 'name') {
      const currentQuery = queryClient.getQueryData<any[]>([
        'batch',
        'getOwner',
        'getExpiry',
        selectedItem.value,
      ])
      if (currentQuery) {
        const [ownerData, wrapperData, expiryData, priceData] = currentQuery
        const registrationStatus = getRegistrationStatus({
          name: selectedItem.value,
          ownerData,
          wrapperData,
          expiryData,
          priceData,
        })
        if (registrationStatus === 'available') {
          path = `/register/${selectedItem.value}`
        }
      }
    }
    if ('isHistory' in selectedItem) {
      delete (selectedItem as SearchItem & { isHistory?: boolean }).isHistory
    }
    setHistory((prev) => [
      ...prev
        .filter((item) => !(item.value === selectedItem.value && item.type === selectedItem.type))
        .slice(0, 25),
      { ...selectedItem, lastAccessed: Date.now() } as HistoryItem,
    ])
    setInputVal('')
    searchInputRef.current?.blur()
    router.pushWithHistory(path)
  }, [normalisedName, queryClient, router, searchItems, selected, setHistory])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        return handleSearch()
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelected((prev) => (prev - 1 + searchItems.length) % searchItems.length)
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelected((prev) => (prev + 1) % searchItems.length)
      }
    },
    [handleSearch, searchItems.length],
  )

  const handleHover = (index: number) => {
    if (selected !== index) {
      setSelected(index)
    }
  }

  useEffect(() => {
    if (inputVal === '') {
      setSelected(-1)
    } else {
      setSelected(0)
    }
  }, [inputVal])

  useEffect(() => {
    if (state === 'unmounted') {
      setSelected(-1)
    }
  }, [state])

  useEffect(() => {
    debouncer(() => setUsingPlaceholder(false))
    setUsingPlaceholder(true)
  }, [inputVal])

  useEffect(() => {
    if (setSearchState) {
      setSearchState(state)
    }
  }, [setSearchState, state])

  useEffect(() => {
    const searchInput = searchInputRef.current
    searchInput?.addEventListener('keydown', handleKeyDown)
    searchInput?.addEventListener('focusin', handleFocusIn)
    searchInput?.addEventListener('focusout', handleFocusOut)
    return () => {
      searchInput?.removeEventListener('keydown', handleKeyDown)
      searchInput?.removeEventListener('focusin', handleFocusIn)
      searchInput?.removeEventListener('focusout', handleFocusOut)
    }
  }, [handleFocusIn, handleFocusOut, handleKeyDown, searchInputRef])

  const SearchInputElement = (
    <SearchInputBox
      containerRef={searchInputContainerRef}
      ref={searchInputRef}
      input={inputVal}
      setInput={setInputVal}
      size={size}
    />
  )

  const SearchResultsElement = (
    <SearchResultsContainer
      style={{
        width: width === Infinity ? undefined : width,
      }}
      onMouseLeave={() => inputVal === '' && setSelected(-1)}
      $state={state}
      $error={!isValid && inputVal !== ''}
      data-testid="search-input-results"
    >
      {searchItems.map((item, index) => (
        <SearchResult
          clickCallback={handleSearch}
          hoverCallback={handleHover}
          index={index}
          selected={selected}
          type={item.type}
          usingPlaceholder={item.isHistory ? false : usingPlaceholder}
          key={`${item.type}-${item.value}`}
          value={item.value || normalisedName}
        />
      ))}
    </SearchResultsContainer>
  )

  if (breakpoints.sm) {
    return (
      <Container data-testid="search-input-desktop" $size={size}>
        {SearchInputElement}
        {state !== 'unmounted' && SearchResultsElement}
      </Container>
    )
  }

  return (
    <Container data-testid="search-input-mobile" $size="extraLarge">
      <MobileSearchInput
        {...{
          SearchInputElement,
          SearchResultsElement,
          searchInputRef,
          state,
          toggle,
        }}
      />
    </Container>
  )
}
