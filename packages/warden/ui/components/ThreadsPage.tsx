import { Link, useLoaderData } from '@tanstack/react-router'

export type Thread = {
  userId: string
  userName: string
  externalId: string
}

export function ThreadsPage() {
  const { threads } = useLoaderData({ from: '/_app/threads' })

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-neutral-100">Conversations</h1>
        <span className="bg-neutral-900 px-3 py-1 rounded-full text-xs font-medium text-neutral-400 border border-neutral-800">
          {threads.length} {threads.length === 1 ? 'conversation' : 'conversations'}
        </span>
      </div>

      {threads.length === 0 ? (
        <div className="bg-neutral-900 rounded-xl p-12 text-center border border-dashed border-neutral-800">
          <div className="w-16 h-16 bg-neutral-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-neutral-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-neutral-100 mb-1">No conversations</h3>
          <p className="text-neutral-400 text-sm">Incoming messages will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {threads.map((t) => (
            <Link
              key={t.userId}
              to="/chat/$userId"
              params={{ userId: t.userId }}
              className="block bg-neutral-900 border border-neutral-800 rounded-xl p-4 hover:bg-neutral-800/50 hover:border-neutral-700 transition-colors no-underline"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-sm shrink-0">
                  {t.userName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-neutral-100 truncate">{t.userName}</div>
                  <div className="text-sm text-neutral-500 font-mono truncate">{t.externalId}</div>
                </div>
                <svg
                  className="w-5 h-5 text-neutral-500 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
