import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql`
    ALTER TABLE "asset_keyframe"
      ALTER COLUMN "pts" TYPE bigint[] USING "pts"::bigint[],
      ALTER COLUMN "accDuration" TYPE bigint[] USING "accDuration"::bigint[],
      ALTER COLUMN "ownDuration" TYPE bigint[] USING "ownDuration"::bigint[],
      ALTER COLUMN "totalDuration" TYPE bigint USING "totalDuration"::bigint,
      ALTER COLUMN "packetCount" TYPE bigint USING "packetCount"::bigint,
      ALTER COLUMN "outputFrames" TYPE bigint USING "outputFrames"::bigint
  `.execute(db);
}

export async function down(): Promise<void> {
  // not supported
}
