import apiClient from './client'

export interface TelegramLinkCode {
  code: string
  expires_at: string
}

export async function generateTelegramLinkCode(): Promise<TelegramLinkCode> {
  const response = await apiClient.post<TelegramLinkCode>('/auth/telegram-link-code')
  return response.data
}

export async function unlinkTelegram(): Promise<void> {
  await apiClient.delete('/auth/telegram/link')
}
