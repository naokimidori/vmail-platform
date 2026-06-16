export interface OAuthProvider {
  clientID: string;
  name: string;
  icon?: string;
}

export interface OpenSettings {
  registrationEnabled: boolean;
  mailVerificationEnabled: boolean;
  oauthProviders: OAuthProvider[];
}

export interface PublicSettings {
  cfTurnstileSiteKey: string | null;
  globalTurnstileEnabled: boolean;
}

export interface LoginInput {
  email: string;
  password: string;
  cfToken?: string;
}

export interface RegisterInput extends LoginInput {
  code?: string;
}

export interface VerifyCodeInput {
  email: string;
  cfToken?: string;
}

export interface VerifyCodeResult {
  success: boolean;
  expirationTtl: number | null;
}

export interface UserSession {
  token: string;
}

export interface UserSettings {
  userEmail: string;
  userId: string;
  role: string | null;
  isAdmin: boolean;
  accessToken: string | null;
  refreshedUserToken: string | null;
}

export interface BoundAddress {
  id: string;
  email: string;
  mailCount: number;
  sendCount: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface CreateAddressInput {
  name?: string;
  domain: string;
  cfToken?: string;
  enableRandomSubdomain?: boolean;
}

export interface CreatedAddress {
  id: string;
  email: string;
  addressToken: string;
}

export interface RawMail {
  id: string;
  address: string;
  raw: string;
  createdAt: string | null;
}

export interface ParsedMail {
  id: string;
  subject: string;
  text: string;
  html: string;
  from: string;
  to: string;
  createdAt: string | null;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}
