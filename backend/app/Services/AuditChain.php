<?php

namespace App\Services;

use App\Support\BusinessTime;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Tamper evidence for the audit log. Entries are sealed in id order: each
 * one stores an HMAC-SHA-256 of its own columns plus the previous entry's
 * hash. The key is derived from APP_KEY, which is never in the database, so
 * someone with database access alone cannot edit an entry and recompute the
 * chain. Editing a sealed entry, deleting one, or removing the newest ones
 * (checked against the head kept in the application cache) is reported.
 *
 * Sealing runs every five minutes (routes/console.php) and before each
 * integrity check. Entries younger than SEAL_AFTER_SECONDS wait, so one
 * written by a slower request with a lower id is not skipped.
 */
class AuditChain
{
    public const SEAL_AFTER_SECONDS = 30;

    private const BATCH = 100;

    private const MAX_PROBLEMS = 20;

    private const HEAD_KEY = 'audit-chain:head';

    private const REPORT_KEY = 'audit-chain:report';

    /** Hashed in this order; the previous hash is appended. */
    private const COLUMNS = ['id', 'created_at', 'user_id', 'clinic_id', 'action', 'subject_type', 'subject_id', 'metadata', 'ip_address', 'user_agent'];

    /** Seals entries that are not sealed yet. Returns how many were sealed. */
    public function seal(): int
    {
        return Cache::lock('audit-chain:seal', 120)->block(15, function () {
            $last = DB::table('audit_logs')->whereNotNull('hash')->orderByDesc('id')->first(['id', 'hash']);
            $prev = $last?->hash;
            $after = $last?->id ?? 0;
            $sealed = 0;

            while (true) {
                $rows = DB::table('audit_logs')
                    ->whereNull('hash')
                    ->where('id', '>', $after)
                    ->where('created_at', '<=', now()->subSeconds(self::SEAL_AFTER_SECONDS))
                    ->orderBy('id')
                    ->limit(self::BATCH)
                    ->get(self::COLUMNS);
                if ($rows->isEmpty()) {
                    break;
                }

                $hashes = [];
                foreach ($rows as $row) {
                    $hash = $this->hash($row, $prev);
                    $hashes[$row->id] = [$prev, $hash];
                    $prev = $hash;
                    $after = $row->id;
                }
                $this->write($hashes);
                $sealed += count($hashes);
            }

            if ($sealed > 0) {
                Cache::forever(self::HEAD_KEY, ['id' => $after, 'hash' => $prev]);
            }

            return $sealed;
        });
    }

    /** Seals, then re-checks every sealed entry. The report is kept for the dashboard. */
    public function verify(): array
    {
        $this->seal();
        $head = Cache::get(self::HEAD_KEY);
        $problems = [];
        $prev = null;
        $checked = 0;
        $lastId = null;
        $headSeen = false;
        $flag = function (int $id, string $type, string $message) use (&$problems) {
            if (count($problems) < self::MAX_PROBLEMS) {
                $problems[] = ['id' => $id, 'type' => $type, 'message' => $message];
            }
        };

        DB::table('audit_logs')->whereNotNull('hash')->select([...self::COLUMNS, 'prev_hash', 'hash'])
            ->chunkById(500, function ($rows) use (&$prev, &$checked, &$lastId, &$headSeen, $head, $flag) {
                foreach ($rows as $row) {
                    if ($row->prev_hash !== $prev) {
                        $flag($row->id, 'chain_broken', 'The entry before this one was deleted or altered.');
                    } elseif (! hash_equals($this->hash($row, $prev), (string) $row->hash)) {
                        $flag($row->id, 'modified', 'This entry was changed after it was sealed.');
                    }
                    if ($head && (int) $row->id === (int) $head['id']) {
                        $headSeen = true;
                        if (! hash_equals((string) $head['hash'], (string) $row->hash)) {
                            $flag($row->id, 'head_mismatch', 'The newest sealed entry does not match the recorded seal.');
                        }
                    }
                    // Continue from the stored hash so one change is reported once.
                    $prev = $row->hash;
                    $lastId = $row->id;
                    $checked++;
                }
            });

        if ($head && ! $headSeen) {
            $flag((int) $head['id'], 'tail_removed', 'Sealed entries up to this id are missing: the newest entries were deleted.');
        }

        // Unsealed entries older than a sealed one were skipped or had their seal removed.
        $skipped = $lastId === null ? 0 : DB::table('audit_logs')->whereNull('hash')->where('id', '<', $lastId)->count();
        if ($skipped > 0) {
            $first = (int) DB::table('audit_logs')->whereNull('hash')->where('id', '<', $lastId)->min('id');
            $flag($first, 'unsealed', "{$skipped} older ".($skipped === 1 ? 'entry is' : 'entries are').' not part of the chain.');
        }

        $report = [
            'status' => $problems ? 'failed' : 'verified',
            'checked' => $checked,
            'sealed_through_id' => $lastId,
            'pending' => DB::table('audit_logs')->whereNull('hash')->where('id', '>', $lastId ?? 0)->count(),
            'problems' => $problems,
            'checked_at' => BusinessTime::iso(now()),
        ];
        Cache::forever(self::REPORT_KEY, $report);

        return $report;
    }

    /** The last integrity report, if a check has run. */
    public function lastReport(): ?array
    {
        return Cache::get(self::REPORT_KEY);
    }

    private function hash(object $row, ?string $prev): string
    {
        $fields = array_map(fn (string $column) => $row->{$column} === null ? null : (string) $row->{$column}, self::COLUMNS);
        $fields[] = $prev;

        return hash_hmac('sha256', json_encode($fields, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), $this->key());
    }

    private function key(): string
    {
        return hash_hmac('sha256', 'audit-log-chain', (string) config('app.key'), true);
    }

    /** One UPDATE per batch (a remote database makes per-row updates slow). Sealed rows are never rewritten. */
    private function write(array $hashes): void
    {
        $prevCase = $hashCase = '';
        $prevBindings = $hashBindings = [];
        foreach ($hashes as $id => [$prev, $hash]) {
            $prevCase .= ' WHEN ? THEN ?';
            array_push($prevBindings, $id, $prev);
            $hashCase .= ' WHEN ? THEN ?';
            array_push($hashBindings, $id, $hash);
        }
        $ids = array_keys($hashes);

        DB::update(
            "UPDATE audit_logs SET prev_hash = CASE id{$prevCase} END, hash = CASE id{$hashCase} END
             WHERE hash IS NULL AND id IN (".implode(', ', array_fill(0, count($ids), '?')).')',
            [...$prevBindings, ...$hashBindings, ...$ids],
        );
    }
}
