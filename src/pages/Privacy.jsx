import LegalPage, { Section } from './LegalPage'
import { SITE_NAME, CONTACT_EMAIL } from '../lib/legal'

const STORAGE = [
  ['Sign-in session', 'Keeps you logged in as an organizer.', 'Essential'],
  ['Offline cache (browser database)', 'Keeps tournaments and rosters available when your connection drops.', 'Essential'],
  ['Match in progress', 'Saves the live score, rotation and stats on the scorer’s device so a refresh does not lose the match. Removed when the match ends.', 'Essential'],
  ['Cookie choice', 'Remembers whether you accepted or chose essential only.', 'Essential'],
]

export default function Privacy() {
  return (
    <LegalPage title="Privacy & Cookies">
      <p>
        This explains what {SITE_NAME} collects, why, and the choices you have. We keep it simple: we collect what
        is needed to run tournaments and show scores, and we do not sell your data or run advertising.
      </p>

      <Section title="What we collect">
        <p>
          <span className="text-white">Organizer accounts:</span> your email address and sign-in details (or your Google
          account name and email if you sign in with Google).
        </p>
        <p>
          <span className="text-white">Tournament data you enter:</span> tournament, team and player names, jersey
          numbers, optional player photos, and match results and statistics.
        </p>
        <p>
          <span className="text-white">Spectators:</span> watching public pages needs no account, and we do not ask
          spectators for personal information.
        </p>
      </Section>

      <Section title="How it is used">
        <p>
          To run the service: sign you in, store and display tournaments, calculate standings and leaderboards, and
          show live scores to anyone with the link. Tournament, team, player and score information is{' '}
          <span className="text-white">public</span> on the watch pages by design.
        </p>
      </Section>

      <Section id="cookies" title="Cookies & local storage">
        <p>
          We use a small amount of browser storage that the service needs to work. We do not use advertising or
          tracking cookies.
        </p>
        <div className="rounded-xl border border-white/10 divide-y divide-white/10 overflow-hidden">
          {STORAGE.map(([name, why, kind]) => (
            <div key={name} className="p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-white font-medium">{name}</span>
                <span className="text-[11px] text-emerald-400 shrink-0">{kind}</span>
              </div>
              <p className="text-white/60 text-xs mt-0.5">{why}</p>
            </div>
          ))}
        </div>
        <p>
          You can clear this storage at any time in your browser settings, but you will be signed out and unsaved
          matches on that device may be lost. You can change your cookie choice with “Cookie settings” below. If we
          ever add optional tools such as analytics, they will stay off unless you accept them.
        </p>
      </Section>

      <Section title="Who we share it with">
        <p>
          We use a hosting and database provider (Supabase) to store data and run sign-in, and Google if you choose
          to sign in with Google. They process data for us. We do not sell personal information.
        </p>
      </Section>

      <Section title="Keeping and deleting data">
        <p>
          We keep your data while your account and tournaments exist. Organizers can edit or remove what they
          created. To have your account or specific information deleted, contact us.
        </p>
      </Section>

      <Section title="Players and minors">
        <p>
          Organizers decide which player details to add. If you list people, especially anyone under 18, you must
          have permission to do so. If you are a player or parent and want information corrected or removed, contact
          the organizer or us.
        </p>
      </Section>

      <Section title="Your choices">
        <p>
          You can ask to access, correct or delete your information, and you can stop using the service at any time.
        </p>
      </Section>

      <Section title="Changes">
        <p>We may update this page. The date at the top shows the latest version.</p>
      </Section>

      {CONTACT_EMAIL && (
        <Section title="Contact">
          <p>
            Email{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-emerald-400 hover:text-emerald-300">{CONTACT_EMAIL}</a>.
          </p>
        </Section>
      )}
    </LegalPage>
  )
}
