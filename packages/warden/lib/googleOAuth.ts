import { google } from 'googleapis'

export interface GoogleOAuthConfig {
  clientId: string
  clientSecret: string
}

export function createOAuth2Client(config: GoogleOAuthConfig, redirectUri?: string) {
  return new google.auth.OAuth2(config.clientId, config.clientSecret, redirectUri)
}
