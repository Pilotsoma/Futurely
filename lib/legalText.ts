/**
 * Canonical legal text for myFuturely Terms of Service and Privacy Policy.
 *
 * This is the single source of truth for legal content — consumed by both the
 * web app (app/login/page.tsx) and the mobile app (nextstep-mobile).
 *
 * Do NOT duplicate these strings elsewhere. Import from this module.
 */

export interface LegalSection {
  heading: string
  body: string
}

export const LEGAL_EFFECTIVE_DATE = 'Effective Date: June 18, 2026 · myFuturely, Inc.'

// ─── Terms of Service ─────────────────────────────────────────────────────────

export const TOS_INTRO =
  'By creating an account and using myFuturely, you agree to be bound by these Terms of ' +
  'Service. Please read them carefully.'

export const TOS_SECTIONS: ReadonlyArray<LegalSection> = [
  {
    heading: '1. Eligibility',
    body:
      'You must be at least 13 years of age to use myFuturely. By registering, you confirm ' +
      'that you meet this requirement. If you are under 18, a parent or guardian must review ' +
      'and agree to these terms on your behalf.',
  },
  {
    heading: '2. Acceptable Use',
    body:
      'You agree to use myFuturely only for lawful purposes. You may not use the platform to ' +
      'harass, threaten, or harm others; post content that is obscene, defamatory, or unlawful; ' +
      'attempt to gain unauthorized access to other accounts or systems; or engage in any ' +
      "activity that disrupts the platform or other users' experience.",
  },
  {
    heading: '3. Account Responsibility',
    body:
      'You are responsible for maintaining the confidentiality of your account credentials. ' +
      'You agree to notify us immediately at support@futurely.app if you suspect unauthorized ' +
      'use of your account. myFuturely is not liable for losses resulting from unauthorized ' +
      'access caused by your failure to keep credentials secure.',
  },
  {
    heading: '4. Virtual Items & Coins',
    body:
      "myFuturely's marketplace, virtual coins, and in-app items have no real-world monetary " +
      'value and are not redeemable for cash or external goods. myFuturely reserves the right ' +
      'to modify, adjust, or remove virtual items at any time.',
  },
  {
    heading: '5. Intellectual Property',
    body:
      'All content on myFuturely — including the platform design, logos, and software — is ' +
      'owned by myFuturely, Inc. and protected by applicable intellectual property laws. You ' +
      'may not copy, reproduce, or distribute any platform content without prior written consent.',
  },
  {
    heading: '6. Termination',
    body:
      'myFuturely reserves the right to suspend or terminate accounts that violate these Terms ' +
      'of Service, engage in harmful behavior, or misuse the platform. You may delete your ' +
      'account at any time via Settings → Account.',
  },
  {
    heading: '7. Disclaimer & Limitation of Liability',
    body:
      'myFuturely is provided "as is" without warranties of any kind. We do not guarantee ' +
      'uninterrupted service or that academic data fetched from third-party portals will be ' +
      'accurate or complete. To the extent permitted by law, myFuturely is not liable for ' +
      'indirect, incidental, or consequential damages arising from your use of the platform.',
  },
  {
    heading: '8. Changes to Terms',
    body:
      'We may update these Terms periodically. Material changes will be communicated via email ' +
      'or in-app notice. Continued use of myFuturely after such notice constitutes acceptance ' +
      'of the updated Terms.',
  },
]

// ─── Privacy Policy ───────────────────────────────────────────────────────────

export const PRIVACY_INTRO =
  'This Privacy Policy explains how we collect, use, and protect your information when you ' +
  'use our platform.'

export const PRIVACY_SECTIONS: ReadonlyArray<LegalSection> = [
  {
    heading: '1. Information We Collect',
    body:
      'We collect the information you provide when registering (name, email address, and ' +
      'password). For students who connect their school portal, we temporarily process your ' +
      'Home Access Center credentials solely to fetch your academic data — these credentials ' +
      'are never stored on our servers. We also collect usage data (pages visited, features ' +
      'used) to improve the platform.',
  },
  {
    heading: '2. How We Use Your Information',
    body:
      'Your information is used to operate and personalize the myFuturely platform, display ' +
      'your grades and academic progress, power AI-assisted features, and communicate important ' +
      'account updates. We do not use your data for advertising or sell it to third parties ' +
      'under any circumstances.',
  },
  {
    heading: '3. Data Sharing',
    body:
      'We do not sell, rent, or share your personal information with third parties except as ' +
      'required by law or with your explicit consent. We use industry-standard service providers ' +
      '(hosting, infrastructure) who are contractually bound to protect your data and may not ' +
      'use it for any other purpose.',
  },
  {
    heading: '4. Educational Records (FERPA)',
    body:
      'myFuturely is designed to comply with the Family Educational Rights and Privacy Act ' +
      '(FERPA). Academic data fetched from your school portal is used solely to provide you ' +
      'with the services you request and is never disclosed to unauthorized parties.',
  },
  {
    heading: "5. Children's Privacy (COPPA)",
    body:
      'myFuturely is intended for users who are 13 years of age or older. We do not knowingly ' +
      'collect personal information from children under 13. If you believe a child under 13 has ' +
      'created an account, please contact us and we will promptly delete the account and any ' +
      'associated data.',
  },
  {
    heading: '6. Data Security',
    body:
      'We use encryption in transit (HTTPS/TLS) and at rest to protect your data. Passwords ' +
      'are hashed using industry-standard algorithms and are never stored in plain text. Despite ' +
      'these measures, no system is completely secure — please use a strong, unique password for ' +
      'your account.',
  },
  {
    heading: '7. Your Rights',
    body:
      'You may request access to, correction of, or deletion of your personal data at any time ' +
      'by visiting Settings → Account or contacting us at support@futurely.app. Account ' +
      'deletion permanently removes all your data from our systems within 30 days.',
  },
  {
    heading: '8. Changes to This Policy',
    body:
      'We may update this Privacy Policy periodically. We will notify you of material changes ' +
      'via email or an in-app notice. Continued use of myFuturely after such notice constitutes ' +
      'acceptance of the updated policy.',
  },
  {
    heading: '9. Contact Us',
    body: 'Questions or concerns? Reach us at support@futurely.app.',
  },
]
