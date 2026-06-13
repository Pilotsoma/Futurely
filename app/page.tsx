import Link from 'next/link'

const FEATURES = [
  { icon: '📊', title: 'Grade Viewer', desc: 'Connect your school portal. View grades, GPA, and transcripts in one place.' },
  { icon: '🎯', title: 'GPA Simulator', desc: 'See how grade changes would affect your GPA in real time with what-if scenarios.' },
  { icon: '📅', title: 'Smart Planner', desc: 'AI-organized assignment planner that keeps you on top of every deadline.' },
  { icon: '🗺️', title: 'HS Roadmap', desc: 'Track graduation requirements and get personalized college readiness guidance.' },
]

const PROBLEMS = [
  { icon: '😵', title: 'Scattered Grades', desc: 'Grades live in outdated portals no one wants to use. NextStep brings them together.' },
  { icon: '😐', title: 'No Personalization', desc: 'Generic planners ignore your actual schedule. NextStep adapts to your courses.' },
  { icon: '🤔', title: 'College Mystery', desc: 'How does today\'s grade affect your future? NextStep makes the connection clear.' },
]

export default function LandingPage() {
  return (
    <div style={styles.page}>
      {/* Hero */}
      <section style={styles.hero}>
        <a href="/"><img src="/logo.jpg" alt="NextStep" style={{ width: 160, height: 80, objectFit: 'contain', marginBottom: 24 }} /></a>
        <div style={styles.heroBadge}>MVP Build · 2026</div>
        <h1 style={styles.heroHeading}>Your AI-Powered<br />Academic Companion</h1>
        <p style={styles.heroSub}>
          NextStep helps high school students track grades, plan assignments,
          and prepare for college — all in one app.
        </p>
        <Link href="/login" style={styles.ctaBtn}>Get Started →</Link>
      </section>

      {/* Problems */}
      <section style={styles.section}>
        <h2 style={styles.sectionHeading}>The Problem We Solve</h2>
        <div style={styles.grid3}>
          {PROBLEMS.map(p => (
            <div key={p.title} style={styles.card}>
              <div style={styles.cardIcon}>{p.icon}</div>
              <h3 style={styles.cardTitle}>{p.title}</h3>
              <p style={styles.cardDesc}>{p.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section style={styles.section}>
        <h2 style={styles.sectionHeading}>Everything You Need</h2>
        <div style={styles.grid4}>
          {FEATURES.map(f => (
            <div key={f.title} style={styles.featureCard}>
              <div style={styles.featureIcon}>{f.icon}</div>
              <h3 style={styles.featureTitle}>{f.title}</h3>
              <p style={styles.featureDesc}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={styles.ctaSection}>
        <h2 style={styles.ctaHeading}>Start your NextStep today</h2>
        <p style={styles.ctaSub}>Join thousands of students leveling up their academic game.</p>
        <Link href="/login" style={styles.ctaBtn}>Log In to Dashboard →</Link>
      </section>

      {/* Footer */}
      <footer style={styles.footer}>
        NextStep © 2026 · MVP Build
      </footer>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: { maxWidth: '1100px', margin: '0 auto', padding: '0 24px' },
  hero: { textAlign: 'center', padding: '80px 0 60px' },
  heroBadge: { display: 'inline-block', background: 'rgba(0,200,150,0.15)', color: 'var(--primary)', border: '1px solid rgba(0,200,150,0.3)', borderRadius: '100px', padding: '4px 14px', fontSize: '12px', fontWeight: '600', marginBottom: '20px' },
  heroHeading: { fontSize: '52px', fontWeight: '800', lineHeight: '1.15', marginBottom: '20px', letterSpacing: '-1px' },
  heroSub: { fontSize: '18px', color: 'var(--text-secondary)', maxWidth: '560px', margin: '0 auto 32px', lineHeight: '1.7' },
  ctaBtn: { display: 'inline-block', background: 'var(--primary)', color: 'var(--bg)', borderRadius: '10px', padding: '14px 32px', fontWeight: '700', fontSize: '16px', textDecoration: 'none' },
  section: { padding: '60px 0' },
  sectionHeading: { fontSize: '32px', fontWeight: '700', marginBottom: '40px', textAlign: 'center' },
  grid3: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' },
  grid4: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' },
  card: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '24px' },
  cardIcon: { fontSize: '32px', marginBottom: '12px' },
  cardTitle: { fontSize: '18px', fontWeight: '700', marginBottom: '8px' },
  cardDesc: { fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.6' },
  featureCard: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '24px' },
  featureIcon: { fontSize: '28px', marginBottom: '12px' },
  featureTitle: { fontSize: '16px', fontWeight: '700', marginBottom: '8px' },
  featureDesc: { fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6' },
  ctaSection: { textAlign: 'center', padding: '60px 0 80px', borderTop: '1px solid var(--border)' },
  ctaHeading: { fontSize: '36px', fontWeight: '800', marginBottom: '12px' },
  ctaSub: { color: 'var(--text-secondary)', marginBottom: '28px', fontSize: '16px' },
  footer: { textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: '13px', borderTop: '1px solid var(--border)' },
}
