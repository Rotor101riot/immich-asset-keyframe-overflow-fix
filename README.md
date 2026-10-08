# Immich `asset_keyframe` int32 overflow — a reference fix

**Status:** Potential fix for [immich-app/immich #29600](https://github.com/immich-app/immich/issues/29600) / [#31855](https://github.com/immich-app/immich/issues/31855), provided for study and voluntary implementation. This is **not** an upstream submission and carries no expectation of acceptance. The fix is published here as a public reference only.

## The bug

`AssetExtractMetadata` fails permanently for certain videos with:

```
PostgresError: value "25620128571" is out of range for type integer
```

The overflowing column is **`asset_keyframe`** — not `asset_exif.rating` (which is guarded to 1–5) and not `asset.duration` (stored as milliseconds).

`probePackets()` in `media.repository.ts` accumulates raw ffprobe packet `pts`/`duration` values in the stream's time base. When the time base is large (e.g. `1/900000000`, `1/1000000000`, `1/600000000`), the accumulated values exceed int32 (`2^31−1`). The affected columns and their widening:

| column | type before | type after |
|---|---|---|
| `pts` | `integer[]` | `bigint[]` |
| `accDuration` | `integer[]` | `bigint[]` |
| `ownDuration` | `integer[]` | `bigint[]` |
| `totalDuration` | `integer` | `bigint` |
| `packetCount` | `integer` | `bigint` |
| `outputFrames` | `integer` | `bigint` |

*Verified against upstream `main`: all six are still `integer`/`integer[]` at the time of writing — the fix has not yet landed.*

## The fix

Two changes against upstream `main`:

1. **`server/src/schema/tables/asset-av.table.ts`** — widen the six `AssetKeyframeTable` columns from `integer` to `bigint` (see `asset-keyframe-table.patch` / the full `asset-av.table.ts`).
2. **A new Kysely migration** — `1790693088455-WidenAssetKeyframeToBigint.ts`, which runs:

```sql
ALTER TABLE "asset_keyframe"
  ALTER COLUMN "pts" TYPE bigint[] USING "pts"::bigint[],
  ALTER COLUMN "accDuration" TYPE bigint[] USING "accDuration"::bigint[],
  ALTER COLUMN "ownDuration" TYPE bigint[] USING "ownDuration"::bigint[],
  ALTER COLUMN "totalDuration" TYPE bigint USING "totalDuration"::bigint,
  ALTER COLUMN "packetCount" TYPE bigint USING "packetCount"::bigint,
  ALTER COLUMN "outputFrames" TYPE bigint USING "outputFrames"::bigint;
```

There is **no on-read cast added** deliberately: the values are consumed by the HLS service only in arithmetic (`*`, `/`, `-`), where JavaScript string-to-number coercion already applies — consistent with how the already-widened `asset_video.bitrate` is handled.

## Verification

Tested against the two real failing assets from a live instance:

| asset | before (overflow value) | after (stored value) |
|---|---|---|
| 28.5 s video | `25620128571` → overflow | `25620128571` stored, `metadataExtractedAt` set |
| 573 s video | `138318170884` → overflow | `138318170884` stored, `metadataExtractedAt` set |

Both extracted cleanly with zero `out of range for type integer` errors after applying the widened columns. Full details in `VERIFICATION.md`.

## Provenance

This fix was developed in the course of my own reporting on [immich issue #31855](https://github.com/immich-app/immich/issues/31855), which was closed as a duplicate of #29600. It is published here as a reference — not an upstream submission.

The work was produced **with LLM assistance** (diagnosis, SQL, and migration drafted with an AI agent), **directed, reviewed, and verified by a human** who ran it against live failing files as shown above. It is shared transparently about that origin and without any pull-request intent.

## Context for maintainers

Previous attempt [immich-app/immich#30292](https://github.com/immich-app/immich/pull/30292) (normalizing values) was closed with the note that *"changing columns prone to overflow (and only those columns) to use bigint would be simpler and more accurate."* This repo implements that suggested approach, for reference.

## Files

- `README.md` — this document
- `VERIFICATION.md` — the live-instance before/after proof
- `asset-keyframe-table.patch` — the table-schema change as a patch
- `server-src-schema-tables-asset-av.table.ts` — the full fixed table file (upstream `main` with the six columns widened)
- `migration-WidenAssetKeyframeToBigint.ts` — the Kysely migration

## License

Published under [GNU AGPL-3.0](LICENSE), the same license as the upstream Immich project. This is a reference implementation, not affiliated with or endorsed by the Immich project.
