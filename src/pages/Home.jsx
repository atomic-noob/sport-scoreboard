const SPORTS = [
  { id: 'basketball', name: 'Basketball', ready: true },
  { id: 'volleyball', name: 'Volleyball', ready: false },
  { id: 'badminton', name: 'Badminton', ready: false },
  { id: 'soccer', name: 'Soccer', ready: false },
  { id: 'tennis', name: 'Tennis', ready: false },
  { id: 'pickleball', name: 'Pickleball', ready: false },
]

export default function Home() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold text-slate-900 mb-1">All-Sport Scoreboard</h1>
      <p className="text-slate-500 mb-8">Pick a sport to set up or score a game.</p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {SPORTS.map((sport) => (
          <div
            key={sport.id}
            className={`rounded-xl border p-5 text-center font-medium transition ${
              sport.ready
                ? 'border-slate-200 bg-white hover:border-orange-400 hover:shadow-md cursor-pointer text-slate-800'
                : 'border-slate-100 bg-slate-50 text-slate-400 cursor-not-allowed'
            }`}
          >
            {sport.name}
            {!sport.ready && (
              <div className="text-xs mt-1 font-normal">Coming soon</div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
