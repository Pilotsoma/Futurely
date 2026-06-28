const VERIFIED_BADGE_URL = 'https://static.vecteezy.com/system/resources/thumbnails/047/309/918/small/verified-badge-profile-icon-png.png'

export default function VerifiedBadge({ variant, size = 18 }: { variant: 'yellow' | 'blue'; size?: number }) {
  return (
    <img
      src={VERIFIED_BADGE_URL}
      alt="Verified"
      style={{ width: size, height: size, verticalAlign: 'middle', flexShrink: 0, display: 'inline-block',
        filter: variant === 'yellow' ? 'hue-rotate(195deg) saturate(2) brightness(1.3)' : undefined }}
    />
  )
}
