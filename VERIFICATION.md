# Verification

This fix was verified against a live Immich instance with the two real failing assets.

## Environment

- Immich server built from this change (upstream `main` + the `asset_keyframe` bigint widening)
- PostgreSQL 14
- Assets: `a30634ee-ccc3-46fb-9eab-f00ed1c75076.mp4` (28.5 s) and `dc6fa2ec-d128-444a-ad8c-706856b96b56.mp4` (573 s)

## Before the fix

Both files threw on `AssetExtractMetadata` and retried indefinitely:

```
PostgresError: value "25620128571" is out of range for type integer
PostgresError: value "138318170884" is out of range for type integer
```

(The values are `probePackets()` packet-duration sums for a `time_base=1/900000000` video stream, which overflow the int32 `asset_keyframe` columns.)

## After the fix

Both files extracted cleanly. The values that previously overflowed are stored without error in the widened `bigint` columns:

| `originalPath` | `totalDuration` | `packetCount` | `outputFrames` | keyframes | `metadataExtractedAt` |
|---|---|---|---|---|---|
| `a30634ee-...mp4` | `25620128571` | 765 | 765 | 9 | set |
| `dc6fa2ec-...mp4` | `138318170884` | 13674 | 13603 | 192 | set |

Server logs during verification: **0** occurrences of `out of range for type integer`.

## Reproduction

Schema before (upstream `main`):

```sql
\d asset_keyframe
-- pts/accDuration/ownDuration: integer[]
-- totalDuration/packetCount/outputFrames: integer
```

Apply the migration, re-run metadata extraction on an affected asset, and the job completes instead of overflowing.
