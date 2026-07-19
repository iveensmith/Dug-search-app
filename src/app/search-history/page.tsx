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

  const load = useCallback(async () => {
    const res = await fetch('/api/search-history')
    if (res.status === 401) {
      router.push('/login?next=/search-history')
      return
    }
    setSearches((await res.json()).searches)
  }, [router])

  useEffect(() => {
    const timer = setTimeout(load, 0)
    return () => clearTimeout(timer)
  }, [load])

  return (
    <div className="flex min-h-dvh w-full flex-col">
      <SiteHeader />
      <div className="mx-auto w-full max-w-2xl flex-1 px-4 pb-16">
        <header className="py-6">
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-50">Search history</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Drugs you&apos;ve searched for while logged in
          </p>
        </header>

        {!searches ? (
          <p className="py-8 text-center text-gray-500 dark:text-gray-400">Loading…</p>
        ) : searches.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-gray-300 p-8 text-center dark:border-gray-700">
            <IconSearch className="text-gray-400 dark:text-gray-500" />
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Nothing here yet — searches you run while logged in will show up here.
            </p>
            <Link href="/" className="mt-3 text-sm font-medium text-emerald-700 underline underline-offset-2 dark:text-emerald-400">
              Search for a drug
            </Link>
          </div>
        ) : (
          <ul className="space-y-2">
            {searches.map((s) => (
              <li key={s.id}>
                <Card className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                      {s.drug ? drugLabel(s.drug) : `“${s.queryText}”`}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
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
      </div>
      <SiteFooter />
    </div>
  )
}
