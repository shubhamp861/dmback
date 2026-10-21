export interface SignupOtpEmail {
  to: string;
  otp: string;
  expiresInMinutes: number;
}

export interface EmailProvider {
  sendSignupOtp(email: SignupOtpEmail): Promise<void>;
}

/**
 * Development-safe provider. It deliberately does not send mail or log OTPs;
 * tests and local callers can inspect the messages they supplied to it.
 */
export class FakeEmailProvider implements EmailProvider {
  readonly signupOtpMessages: SignupOtpEmail[] = [];

  async sendSignupOtp(email: SignupOtpEmail): Promise<void> {
    this.signupOtpMessages.push({ ...email });
  }
}
