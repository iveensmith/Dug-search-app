'use client'

import Button from '@/components/ui/Button'

/**
 * The bottom of a paginated list: how much is on screen, and a way to get
 * the next page. Same control for cursor and offset lists so they behave
 * identically — pass `total` when the endpoint knows it.
 */
export default function LoadMore({
  shown,
  total,
  hasMore,
  loading,
  onLoadMore,
  noun = 'items',
}: {
  shown: number
  total?: number | null
  hasMore: boolean
  loading: boolean
  onLoadMore: () => void
  noun?: string
}) {
  if (shown === 0) return null

  return (
    <div className="mt-4 flex flex-col items-center gap-2">
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {total != null && total > shown
          ? `Showing ${shown} of ${total} ${noun}`
          : `${shown} ${shown === 1 ? noun.replace(/s$/, '') : noun}`}
      </p>
      {hasMore && (
        <Button variant="outline" size="sm" loading={loading} onClick={onLoadMore}>
          {loading ? 'Loading…' : 'Load more'}
        </Button>
      )}
    </div>
  )
}
