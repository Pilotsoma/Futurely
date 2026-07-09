import React from 'react'
import { StyleSheet, Text as RNText, type StyleProp, type TextStyle, type TextProps as RNTextProps } from 'react-native'

type Variant = 'display' | 'heading' | 'h2' | 'h3' | 'body' | 'caption' | 'label'

interface TextProps extends Omit<RNTextProps, 'style'> {
  variant?: Variant
  color?: string
  className?: string
  style?: StyleProp<TextStyle>
  children: React.ReactNode
}

// Weight classes carry font-family (not fontWeight) — the app's typefaces
// (Inter, Space Grotesk) are loaded as separate static files per weight, and
// custom fonts largely ignore the `fontWeight` style prop on both platforms.
const variantClasses: Record<Variant, string> = {
  display: 'text-[32px] font-sans-extrabold tracking-[-0.5px] text-[#EDEEFF] leading-[36px]',
  heading: 'text-[24px] font-display tracking-[-0.3px] text-[#EDEEFF] leading-[30px]',
  h2: 'text-[20px] font-sans-semibold text-[#EDEEFF] leading-[28px]',
  h3: 'text-[16px] font-sans-semibold text-[#EDEEFF] leading-[22px]',
  body: 'text-[15px] font-sans text-[#EDEEFF] leading-6',
  caption: 'text-[12px] font-sans text-[#8B8FB5] leading-5',
  label: 'text-[12px] font-sans-semibold uppercase tracking-[0.8px] text-[#8B8FB5] leading-5',
}

// Screens across the app set an inline `fontWeight` (e.g. `{ fontWeight: '700' }`)
// expecting the OS system font to bolden. Since we now load static per-weight
// Inter files, fontWeight alone no longer changes anything visually — so any
// inline fontWeight override is mapped here to the matching Inter file and
// applied last, guaranteeing it wins over the variant's default font-family.
const WEIGHT_FONT_MAP: Record<string, string> = {
  '400': 'Inter_400Regular',
  normal: 'Inter_400Regular',
  '500': 'Inter_500Medium',
  '600': 'Inter_600SemiBold',
  '700': 'Inter_700Bold',
  bold: 'Inter_700Bold',
  '800': 'Inter_800ExtraBold',
}

export default function Text({
  variant = 'body',
  color,
  className,
  style,
  children,
  ...rest
}: TextProps): React.JSX.Element {
  const flatStyle = StyleSheet.flatten(style)
  const overrideWeight = flatStyle?.fontWeight !== undefined
    ? WEIGHT_FONT_MAP[String(flatStyle.fontWeight)]
    : undefined

  return (
    <RNText
      className={`${variantClasses[variant]} ${className ?? ''}`}
      style={[
        color !== undefined ? { color } : undefined,
        style,
        overrideWeight !== undefined ? { fontFamily: overrideWeight } : undefined,
      ]}
      {...rest}
    >
      {children}
    </RNText>
  )
}
