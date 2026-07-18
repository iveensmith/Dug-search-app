import { type HTMLAttributes } from 'react'

type Props = HTMLAttributes<HTMLDivElement> & {
  padded?: boolean
}

export default function Card({ padded = true, className = '', children, ...props }: Props) {
  return (
    <div
      className={`rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900 ${padded ? 'p-4' : ''} ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
