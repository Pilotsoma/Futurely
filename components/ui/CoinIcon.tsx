interface CoinIconProps {
  size?: number
  style?: React.CSSProperties
}

export default function CoinIcon({ size = 14, style }: CoinIconProps) {
  return (
    <img
      src="/coin.png"
      onError={(e) => { (e.target as HTMLImageElement).src = 'https://www.iconpacks.net/icons/2/free-coin-icon-2159-thumb.png' }}
      alt="coin"
      width={size}
      height={size}
      style={{ display: 'inline-block', verticalAlign: 'middle', objectFit: 'contain', ...style }}
    />
  )
}
