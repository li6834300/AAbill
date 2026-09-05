import type { Plan } from '@aabill/api-types';
import type { Pool } from 'pg';
import { normalizeEmail, type User, type UserRepo } from '../users.js';

interface UserRow {
  id: string;
  email: string;
  password_hash: string | null;
  plan: Plan;
  created_at: Date;
}

const toUser = (r: UserRow): User => ({
  id: r.id,
  email: r.email,
  passwordHash: r.password_hash,
  plan: r.plan,
  createdAt: r.created_at.toISOString(),
});

export function createPostgresUserRepo(pool: Pool): UserRepo {
  async function upsert(user: User): Promise<User> {
    await pool.query(
      `insert into users (id, email, password_hash, plan, created_at)
       values ($1, $2, $3, $4, $5)
       on conflict (id) do update set
         email = excluded.email,
         password_hash = excluded.password_hash,
         plan = excluded.plan`,
      [
        user.id,
        normalizeEmail(user.email),
        user.passwordHash,
        user.plan,
        user.createdAt,
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
  };
}
