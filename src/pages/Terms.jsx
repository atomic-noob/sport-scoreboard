import LegalPage, { Section } from './LegalPage'
import { SITE_NAME, CONTACT_EMAIL, GOVERNING_LAW } from '../lib/legal'

export default function Terms() {
  return (
    <LegalPage title="Terms & Conditions">
      <p>
        These terms apply when you use {SITE_NAME}, a tool for running tournaments, scoring games and watching
        scores live. By creating an account or using the service you agree to them. If you do not agree, please do
        not use it.
      </p>

      <Section title="1. Watching vs. organizing">
        <p>
          Anyone can watch public scores, schedules, standings and leaderboards without an account. You need an
          account to create tournaments, manage teams and rosters, or score games.
        </p>
      </Section>

      <Section title="2. Your account">
        <p>
          Keep your login details private and give us accurate information. You are responsible for what happens
          under your account. Tell us if you think someone else has accessed it.
        </p>
      </Section>

      <Section title="3. Content you add">
        <p>
          You own the tournaments, teams, player names, photos and results you enter. You give us permission to
          store them and to show them publicly through the watch pages, because that is how the service works.
        </p>
        <p>
          Only add information you have the right to share. If you list players, especially minors, make sure you
          have permission from them or their guardians. Do not add sensitive personal details such as home
          addresses or government ID numbers.
        </p>
      </Section>

      <Section title="4. Acceptable use">
        <p>
          Do not use {SITE_NAME} to break the law, harass or impersonate others, post offensive or misleading
          content, enter false results to deceive people, attack or overload the service, or try to access data
          that is not yours.
        </p>
      </Section>

      <Section title="5. Scores and statistics">
        <p>
          Scores, standings and statistics are entered by organizers and scorers. We do not verify them and are not
          responsible for mistakes, disputes or decisions made from them.
        </p>
      </Section>

      <Section title="6. Availability">
        <p>
          We work to keep the service running, but it is provided “as is” and “as available”, without guarantees.
          It may be interrupted, changed or stopped, and features may change. Keep your own record of important
          results.
        </p>
      </Section>

      <Section title="7. Limit of liability">
        <p>
          To the extent the law allows, we are not liable for indirect or consequential losses, lost data or lost
          opportunities arising from your use of the service.
        </p>
      </Section>

      <Section title="8. Ending your use">
        <p>
          You can stop using the service at any time. We may suspend or remove accounts or content that break these
          terms.
        </p>
      </Section>

      <Section title="9. Privacy and cookies">
        <p>
          How we handle personal information, cookies and local storage is explained in our Privacy &amp; Cookies
          page.
        </p>
      </Section>

      <Section title="10. Changes">
        <p>
          We may update these terms. The date at the top shows the latest version. Continuing to use the service
          after a change means you accept it.
        </p>
      </Section>

      {GOVERNING_LAW && (
        <Section title="11. Governing law">
          <p>These terms are governed by the laws of {GOVERNING_LAW}.</p>
        </Section>
      )}

      {CONTACT_EMAIL && (
        <Section title="Contact">
          <p>
            Questions? Email{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-emerald-400 hover:text-emerald-300">{CONTACT_EMAIL}</a>.
          </p>
        </Section>
      )}
    </LegalPage>
  )
}
