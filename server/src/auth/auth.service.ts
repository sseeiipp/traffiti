import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { config } from '../config.js';
import { DbService } from '../db/db.service.js';

export type Provider = 'email' | 'kakao' | 'naver' | 'google';

@Injectable()
export class AuthService {
  constructor(
    private readonly db: DbService,
    private readonly jwt: JwtService,
  ) {}

  issue(userId: number) {
    return {
      accessToken: this.jwt.sign({ sub: userId, typ: 'access' }, { expiresIn: '7d' }),
      refreshToken: this.jwt.sign({ sub: userId, typ: 'refresh' }, { expiresIn: '30d' }),
    };
  }

  refresh(token: string) {
    try {
      const p = this.jwt.verify<{ sub: number; typ: string }>(token);
      if (p.typ !== 'refresh') throw new Error();
      return this.issue(p.sub);
    } catch {
      throw new UnauthorizedException('다시 로그인해 주세요.');
    }
  }

  private assertTerms(terms: { tos?: boolean; location?: boolean }) {
    if (!terms?.tos || !terms?.location) throw new BadRequestException('필수 약관에 동의해 주세요.');
  }

  async signupEmail(input: { email: string; password: string; name: string; terms: any }) {
    this.assertTerms(input.terms);
    const email = input.email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new BadRequestException('이메일 형식을 확인해 주세요.');
    if ((input.password ?? '').length < 8) throw new BadRequestException('비밀번호는 8자 이상이에요.');
    const name = (input.name ?? '').trim().slice(0, 10);
    if (!name) throw new BadRequestException('크루에서 쓸 이름을 넣어 주세요.');
    const hash = await bcrypt.hash(input.password, 10);
    const userId = await this.db.tx(async (c) => {
      const exists = await this.db.one('SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL', [email], c);
      if (exists) throw new ConflictException('이미 가입한 이메일이에요.');
      const u = await this.db.one<{ id: number }>(
        `INSERT INTO users (display_name, email, auth_provider) VALUES ($1, $2, 'email') RETURNING id`,
        [name, email],
        c,
      );
      await c.query(
        `INSERT INTO user_auth_accounts (user_id, provider, provider_subject, password_hash) VALUES ($1, 'email', $2, $3)`,
        [u!.id, email, hash],
      );
      await c.query(`INSERT INTO user_settings (user_id, terms_agreed_at, marketing_agreed) VALUES ($1, now(), $2)`, [
        u!.id,
        !!input.terms.marketing,
      ]);
      return u!.id;
    });
    return this.issue(userId);
  }

  async loginEmail(emailRaw: string, password: string) {
    const email = (emailRaw ?? '').trim().toLowerCase();
    const acc = await this.db.one<{ user_id: number; password_hash: string }>(
      `SELECT a.user_id, a.password_hash FROM user_auth_accounts a JOIN users u ON u.id = a.user_id
       WHERE a.provider = 'email' AND a.provider_subject = $1 AND u.deleted_at IS NULL`,
      [email],
    );
    if (!acc || !(await bcrypt.compare(password ?? '', acc.password_hash))) {
      throw new UnauthorizedException('이메일이나 비밀번호가 맞지 않아요.');
    }
    return this.issue(acc.user_id);
  }

  /**
   * 소셜 로그인 표(ticket)나 데모 식별자에서 subject를 얻는다.
   * ticket은 서버가 제공자에게 직접 받아 서명한 것이라 믿을 수 있다(oauth.ts).
   * 데모 모드(SOCIAL_LOGIN_DEMO)에서는 기기 식별자를 subject로 받되, 실제 회원 번호와 겹치지 않게
   * 'kakao:device-…'처럼 제공자 이름이 앞에 붙은 값만 받는다.
   */
  private socialSubject(provider: Provider, cred: { ticket?: string; subject?: string }): { subject: string; name?: string } {
    if (cred.ticket) {
      try {
        const t = this.jwt.verify<{ typ: string; p: string; s: string; n?: string }>(cred.ticket);
        if (t.typ !== 'social' || t.p !== provider || !t.s) throw new Error();
        return { subject: t.s, name: t.n };
      } catch {
        throw new UnauthorizedException('로그인 시간이 지났어요. 다시 시도해 주세요.');
      }
    }
    if (!config.socialLoginDemo) throw new BadRequestException('소셜 로그인 설정이 아직 끝나지 않았어요.');
    if (!cred.subject?.startsWith(`${provider}:`)) throw new BadRequestException('로그인 정보가 올바르지 않아요.');
    return { subject: cred.subject };
  }

  async social(provider: Provider, cred: { ticket?: string; subject?: string }, signup?: { name: string; terms: any }) {
    if (!['kakao', 'naver', 'google'].includes(provider)) throw new BadRequestException('지원하지 않는 로그인 방식이에요.');
    const { subject, name: suggestedName } = this.socialSubject(provider, cred);
    const acc = await this.db.one<{ user_id: number }>(
      `SELECT a.user_id FROM user_auth_accounts a JOIN users u ON u.id = a.user_id
       WHERE a.provider = $1 AND a.provider_subject = $2 AND u.deleted_at IS NULL`,
      [provider, subject],
    );
    if (acc) return { ...this.issue(acc.user_id), isNew: false };
    if (!signup) return { needsSignup: true as const, suggestedName: suggestedName?.slice(0, 10) };
    this.assertTerms(signup.terms);
    const name = (signup.name ?? '').trim().slice(0, 10);
    if (!name) throw new BadRequestException('크루에서 쓸 이름을 넣어 주세요.');
    const userId = await this.db.tx(async (c) => {
      const u = await this.db.one<{ id: number }>(
        `INSERT INTO users (display_name, auth_provider) VALUES ($1, $2) RETURNING id`,
        [name, provider],
        c,
      );
      await c.query(`INSERT INTO user_auth_accounts (user_id, provider, provider_subject) VALUES ($1, $2, $3)`, [
        u!.id,
        provider,
        subject,
      ]);
      await c.query(`INSERT INTO user_settings (user_id, terms_agreed_at, marketing_agreed) VALUES ($1, now(), $2)`, [
        u!.id,
        !!signup.terms.marketing,
      ]);
      return u!.id;
    });
    return { ...this.issue(userId), isNew: true };
  }

  async changePassword(userId: number, password: string) {
    if ((password ?? '').length < 8) throw new BadRequestException('비밀번호는 8자 이상이에요.');
    const hash = await bcrypt.hash(password, 10);
    const r = await this.db.pool.query(
      `UPDATE user_auth_accounts SET password_hash = $2 WHERE user_id = $1 AND provider = 'email'`,
      [userId, hash],
    );
    if (!r.rowCount) throw new BadRequestException('이메일 계정만 비밀번호를 바꿀 수 있어요.');
  }
}
