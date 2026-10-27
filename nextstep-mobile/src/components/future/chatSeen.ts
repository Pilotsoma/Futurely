import AsyncStorage from '@react-native-async-storage/async-storage'

const key = (counselorId: number): string => `futurely.counselorChat.lastSeen.${counselorId}`

export async function loadLastSeenId(counselorId: number): Promise<number | null> {
  try {
    const raw = await AsyncStorage.getItem(key(counselorId))
    const n = raw === null ? NaN : Number(raw)
    return Number.isFinite(n) ? n : null
  } catch {
    return null
  }
}

export async function saveLastSeenId(counselorId: number, id: number): Promise<void> {
  try {
    await AsyncStorage.setItem(key(counselorId), String(id))
  } catch {
    // best-effort
  }
}
