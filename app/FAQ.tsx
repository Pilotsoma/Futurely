import Reveal from './Reveal'

const FAQ_ITEMS: { question: string; answer: string }[] = [
  {
    question: 'Is myFuturely free?',
    answer: 'Yes. You can get started with myFuturely for free — grade tracking, the AI academic advisor, and the planner are all included from day one.',
  },
  {
    question: 'How does myFuturely calculate my GPA?',
    answer: 'myFuturely calculates both your weighted and unweighted GPA automatically from your course grades. Each class is weighted by its level — Standard, Honors, AP, or IB — and combined by credit hours, so your GPA updates the moment new grades come in. You can also use the What-If Simulator to see how a hypothetical grade would change your GPA before it happens.',
  },
  {
    question: 'Does myFuturely work for any high school?',
    answer: "myFuturely connects directly to school portals like HAC (Home Access Center) and PowerSchool across a growing list of school districts, and calculates GPA using the weighted scale most of those districts use. When you sign up, you can search for your school — if it isn't listed yet, we're expanding district coverage regularly.",
  },
  {
    question: 'Is my academic data private and secure?',
    answer: "Yes. Your data is encrypted with AES-256, both in transit and at rest, and it's never sold or shared with advertisers, data brokers, or colleges. You can request full deletion of your data at any time.",
  },
  {
    question: 'Can parents use myFuturely?',
    answer: "Yes. Parents can create their own myFuturely account and connect to their student's school portal directly, so they can stay informed on grades and progress without needing their child's login.",
  },
  {
    question: 'How is myFuturely different from a regular planner app?',
    answer: "A planner app just tracks what's due. myFuturely pairs that with an AI academic advisor that actually knows your grades, courses, and history — so it can tell you what to focus on, not just what's on your calendar.",
  },
]

const FAQ_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ_ITEMS.map(item => ({
    '@type': 'Question',
    name: item.question,
    acceptedAnswer: {
      '@type': 'Answer',
      text: item.answer,
    },
  })),
}

export default function FAQ() {
  return (
    <section style={{ borderTop: '1px solid var(--border)', padding: '100px 28px' }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_JSON_LD) }}
      />
      <div style={{ maxWidth: 1160, margin: '0 auto' }}>
        <Reveal>
          <p style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: 'var(--purple)', letterSpacing: '2.5px', textTransform: 'uppercase', marginBottom: 16 }}>
            FAQ
          </p>
          <h2 style={{ fontFamily: 'var(--font-display)', textAlign: 'center', fontSize: 'clamp(30px, 4.5vw, 54px)', fontWeight: 500, color: 'var(--text)', letterSpacing: '-1.5px', lineHeight: 1.1, marginBottom: 64 }}>
            Frequently asked questions
          </h2>
        </Reveal>

        <div style={{ maxWidth: 780, margin: '0 auto' }}>
          {FAQ_ITEMS.map((item, i) => (
            <Reveal key={item.question} delay={i * 0.05}>
              <details className="ns-faq-item" style={{ borderTop: '1px solid var(--border)', padding: '22px 0' }}>
                <summary style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>
                  {item.question}
                  <svg className="ns-faq-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, color: 'var(--text-muted)' }}>
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </summary>
                <p style={{ fontSize: 14.5, color: 'var(--text-secondary)', lineHeight: 1.8, marginTop: 14, paddingRight: 36 }}>
                  {item.answer}
                </p>
              </details>
            </Reveal>
          ))}
          <div style={{ borderTop: '1px solid var(--border)' }} />
        </div>
      </div>
    </section>
  )
}
