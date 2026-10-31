import { GoogleIcon } from './GoogleIcon'

export function ConnectPrompt() {
  return (
    <div className="flex justify-center items-center min-h-[60vh] p-4">
      <div className="bg-neutral-900 rounded-2xl p-8 md:p-12 text-center shadow-sm border border-neutral-800 w-full max-w-[480px]">
        <div className="w-16 h-16 md:w-20 md:h-20 bg-amber-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6 text-amber-500">
          <svg
            className="w-10 h-10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
            />
          </svg>
        </div>
        <h2 className="text-2xl text-neutral-100 font-bold mb-3">Calendar not connected</h2>
        <p className="text-neutral-400 text-base mb-8 leading-relaxed max-w-[320px] mx-auto">
          The Google Calendar connection has expired or was never set up. Reconnect to view and
          manage your appointments.
        </p>
        <a
          href="/api/calendar/connect"
          className="inline-flex items-center justify-center gap-3 py-3.5 px-8 rounded-xl text-sm font-semibold cursor-pointer no-underline transition-all bg-primary text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5"
        >
          <GoogleIcon className="w-5 h-5" />
          Reconnect Google Calendar
        </a>
      </div>
    </div>
  )
}
