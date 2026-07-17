import Link from 'next/link'
import { ArrowLeft, ArrowRight } from 'lucide-react'

type PublicPageHeaderProps = {
  actionHref?: string
  actionLabel?: string
}

export function PublicPageHeader({ actionHref, actionLabel }: PublicPageHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-[#E8DCCB] bg-[#FBF6EE]/92 backdrop-blur-xl">
      <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-4 px-5 sm:px-6">
        <Link
          href="/"
          className="group inline-flex min-h-11 items-center gap-3 text-[#2E2116]"
          aria-label="Back to ClearSignal home"
        >
          <span className="grid h-8 w-8 place-items-center rounded-full border border-[#DDCDB9] bg-[#FFFDF9] transition-colors group-hover:border-[#A9531F]">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="text-base font-semibold">ClearSignal</span>
        </Link>

        {actionHref && actionLabel ? (
          <Link
            href={actionHref}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#DCCCB8] bg-[#FFFDF9] px-4 text-sm font-semibold text-[#2E2116] shadow-[0_8px_30px_rgba(67,43,25,0.06)] transition-colors hover:border-[#A9531F] hover:text-[#8C421A]"
          >
            {actionLabel}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        ) : null}
      </div>
    </header>
  )
}
