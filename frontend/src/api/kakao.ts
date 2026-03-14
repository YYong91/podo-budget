import apiClient from './client'

export interface KakaoLinkCode {
  code: string
  expires_at: string
}

export async function generateKakaoLinkCode(): Promise<KakaoLinkCode> {
  const response = await apiClient.post<KakaoLinkCode>('/auth/kakao-link-code')
  return response.data
}

export async function unlinkKakao(): Promise<void> {
  await apiClient.delete('/auth/kakao/link')
}
