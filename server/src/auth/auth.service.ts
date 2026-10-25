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
   * 소셜 로그인. 실제 서비스에서는 각 제공자의 토큰을 서버에서 검증해 subject를 얻어야 한다.
   * 개발자 콘솔 등록 전이라 지금은 데모 모드로, 클라이언트가 보낸 기기 식별자를 subject로 쓴다.
   * 배포(NODE_ENV=production)에서는 SOCIAL_LOGIN_DEMO=true를 주지 않는 한 막힌다.
   */
  async social(provider: Provider, subject: string, signup?: { name: string; terms: any }) {
    if (!config.socialLoginDemo) {
      throw new BadRequestException('소셜 로그인 설정이 아직 끝나지 않았어요.');
    }
    if (!['kakao', 'naver', 'google'].includes(provider)) throw new BadRequestException('지원하지 않는 로그인 방식이에요.');
    const acc = await this.db.one<{ user_id: number }>(
      `SELECT a.user_id FROM user_auth_accounts a JOIN users u ON u.id = a.user_id
       WHERE a.provider = $1 AND a.provider_subject = $2 AND u.deleted_at IS NULL`,
      [provider, subject],
    );
    if (acc) return { ...this.issue(acc.user_id), isNew: false };
    if (!signup) return { needsSignup: true as const };
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
