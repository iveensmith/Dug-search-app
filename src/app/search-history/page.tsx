'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import SiteHeader from '@/components/ui/SiteHeader'
import SiteFooter from '@/components/ui/SiteFooter'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import { drugLabel, type DrugSuggestion } from '@/lib/types'
import { stateLabel } from '@/lib/states'
import LoadMore from '@/components/ui/LoadMore'
import { IconAlertCircle, IconSearch } from '@/components/ui/icons'

type SearchRow = {
  id: string
  queryText: string
  state: string | null
  hadResults: boolean
  createdAt: string
  drug: DrugSuggestion | null
}

export default function SearchHistoryPage() {
  const router = useRouter()
  const [searches, setSearches] = useState<SearchRow[] | null>(null)
  const [cursor, setCursor] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)

  // `after` null loads the first page and replaces; a cursor appends.
  const load = useCallback(
    async (after: string | null = null) => {
      const res = await fetch(`/api/search-history${after ? `?cursor=${after}` : ''}`)
      if (res.status === 401) {
        router.push('/login?next=/search-history')
        return
      }
      const data = await res.json()
      setSearches((prev) => (after && prev ? [...prev, ...data.searches] : data.searches))
      setCursor(data.nextCursor ?? null)
    },
    [router],
  )

  async function loadMore() {
    if (!cursor) return
    setLoadingMore(true)
    try {
      await load(cursor)
    } finally {
      setLoadingMore(false)
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => load(), 0)
    return () => clearTimeout(timer)
  }, [load])

  return (
    <div className="flex min-h-dvh w-full flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-16">
        <header className="py-6">
          <h1 className="font-serif text-xl font-normal text-ink">Search history</h1>
          <p className="text-sm text-muted">
            Drugs you&apos;ve searched for while logged in
          </p>
        </header>

        {!searches ? (
          <p className="py-8 text-center text-faint">Loading…</p>
        ) : searches.length === 0 ? (
          <div className="flex flex-col items-center rounded-card border border-dashed border-line-strong p-8 text-center">
            <IconSearch className="text-faint" />
            <p className="mt-2 text-sm text-faint">
              Nothing here yet — searches you run while logged in will show up here.
            </p>
            <Link href="/" className="mt-3 text-sm font-medium text-brand-ink underline underline-offset-2">
              Search for a drug
            </Link>
          </div>
        ) : (
          <ul className="stagger space-y-2">
            {searches.map((s) => (
              <li key={s.id}>
                <Card className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">
                      {s.drug ? drugLabel(s.drug) : `“${s.queryText}”`}
                    </p>
                    <p className="mt-0.5 text-xs text-faint">
                      {new Date(s.createdAt).toLocaleString()}
                      {s.state ? ` · ${stateLabel(s.state)}` : ''}
                    </p>
                  </div>
                  {!s.hadResults && (
                    <Badge tone="warning" className="shrink-0">
                      <IconAlertCircle width={12} height={12} className="mr-1" />
                      No results
                    </Badge>
                  )}
                </Card>
              </li>
            ))}
          </ul>
        )}

        {searches && searches.length > 0 && (
          <LoadMore
            shown={searches.length}
            hasMore={cursor !== null}
            loading={loadingMore}
            onLoadMore={loadMore}
            noun="searches"
          />
        )}
      </main>
      <SiteFooter />
    </div>
  )
}
