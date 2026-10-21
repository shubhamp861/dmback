import { createHash, randomInt } from 'node:crypto';

export const SIGNUP_OTP_LENGTH = 6;
export const SIGNUP_OTP_EXPIRY_MINUTES = 10;
export const SIGNUP_OTP_RESEND_COOLDOWN_SECONDS = 60;
export const SIGNUP_OTP_MAX_ATTEMPTS = 5;
export const SIGNUP_VERIFICATION_TOKEN_MINUTES = 10;

export function generateSignupOtp(): string {
  return randomInt(0, 1_000_000).toString().padStart(SIGNUP_OTP_LENGTH, '0');
}

/** Bind the OTP hash to its challenge so hashes cannot be reused across rows. */
export function hashSignupOtp(otp: string, challengeId: string): string {
  return createHash('sha256').update(`${challengeId}:${otp}`).digest('hex');
}
