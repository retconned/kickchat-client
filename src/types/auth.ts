export interface ResStatus {
  "2fa_required": boolean;
}

export interface TokenProviderResponse {
  enabled: boolean;
  nameFieldName: string;
  unrandomizedNameFieldName: string;
  validFromFieldName: string;
  encryptedValidFrom: string;
}

export interface Config {
  username: string;
  password: string;
  otp_secret: string;
}
