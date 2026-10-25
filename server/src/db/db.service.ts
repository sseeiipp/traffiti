import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import pg from 'pg';
import { config } from '../config.js';
import { SCHEMA_SQL } from './schema.js';

export type Queryable = Pick<pg.PoolClient, 'query'>;

@Injectable()
export class DbService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(DbService.name);
  readonly pool = new pg.Pool({
    connectionString: config.databaseUrl,
    ssl: config.databaseSsl ? { rejectUnauthorized: false } : undefined,
  });

  async onModuleInit() {
    await this.pool.query(SCHEMA_SQL);
    this.log.log('schema ready');
  }

  async onModuleDestroy() {
    await this.pool.end();
  }

  async many<T = any>(sql: string, params: unknown[] = [], db: Queryable = this.pool): Promise<T[]> {
    return (await db.query(sql, params)).rows as T[];
  }

  async one<T = any>(sql: string, params: unknown[] = [], db: Queryable = this.pool): Promise<T | undefined> {
    return (await db.query(sql, params)).rows[0] as T | undefined;
  }

  async tx<T>(fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
    const c = await this.pool.connect();
    try {
      await c.query('BEGIN');
      const r = await fn(c);
      await c.query('COMMIT');
      return r;
    } catch (e) {
      await c.query('ROLLBACK');
      throw e;
    } finally {
      c.release();
    }
  }
}
