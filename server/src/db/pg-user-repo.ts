import type { Plan } from '@aabill/api-types';
import type { Pool } from 'pg';
import { normalizeEmail, type User, type UserRepo } from '../users.js';

interface UserRow {
  id: string;
  email: string;
  password_hash: string | null;
  plan: Plan;
  created_at: Date;
  email_verified_at: Date | null;
  verification_token_hash: string | null;
  verification_expires_at: Date | null;
}

const toUser = (r: UserRow): User => ({
  id: r.id,
  email: r.email,
  passwordHash: r.password_hash,
  plan: r.plan,
  createdAt: r.created_at.toISOString(),
  emailVerifiedAt: r.email_verified_at?.toISOString() ?? null,
  verificationTokenHash: r.verification_token_hash,
  verificationExpiresAt: r.verification_expires_at?.toISOString() ?? null,
});

export function createPostgresUserRepo(pool: Pool): UserRepo {
  async function upsert(user: User): Promise<User> {
    await pool.query(
      `insert into users (id, email, password_hash, plan, created_at,
                          email_verified_at, verification_token_hash,
                          verification_expires_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       on conflict (id) do update set
         email = excluded.email,
         password_hash = excluded.password_hash,
         plan = excluded.plan,
         email_verified_at = excluded.email_verified_at,
         verification_token_hash = excluded.verification_token_hash,
         verification_expires_at = excluded.verification_expires_at`,
      [
        user.id,
        normalizeEmail(user.email),
        user.passwordHash,
        user.plan,
        user.createdAt,
        user.emailVerifiedAt,
        user.verificationTokenHash,
        user.verificationExpiresAt,
      ],
    );
    return user;
  }

  return {
    create: upsert,
    save: upsert,
    async findByEmail(email) {
      const { rows } = await pool.query<UserRow>(
        'select * from users where email = $1',
        [normalizeEmail(email)],
      );
      return rows[0] ? toUser(rows[0]) : undefined;
    },
    async findById(id) {
      const { rows } = await pool.query<UserRow>(
        'select * from users where id = $1',
        [id],
      );
      return rows[0] ? toUser(rows[0]) : undefined;
    },
    async findByVerificationTokenHash(hash) {
      const { rows } = await pool.query<UserRow>(
        'select * from users where verification_token_hash = $1',
        [hash],
      );
      return rows[0] ? toUser(rows[0]) : undefined;
    },
    async countVerifiedSince(sinceIso) {
      const { rows } = await pool.query<{ n: string }>(
        'select count(*)::text as n from users where email_verified_at >= $1',
        [sinceIso],
      );
      return Number(rows[0]?.n ?? 0);
    },
  };
}
