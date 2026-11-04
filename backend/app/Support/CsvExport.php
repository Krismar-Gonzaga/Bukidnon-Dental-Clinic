<?php

namespace App\Support;

use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

/** CSV downloads for administrators. */
class CsvExport
{
    /** Exports stop here; narrow the filters for more. */
    public const MAX_ROWS = 5000;

    /** Rows to export: ?limit= may ask for fewer (the phone app shares exports as text). */
    public static function limit(Request $request): int
    {
        $request->validate(['limit' => ['nullable', 'integer', 'min:1', 'max:'.self::MAX_ROWS]]);

        return (int) ($request->query('limit') ?: self::MAX_ROWS);
    }

    /**
     * @param  iterable<array>  $rows  lazily produced rows, in header order
     */
    public static function download(string $filename, array $header, iterable $rows): StreamedResponse
    {
        return response()->streamDownload(function () use ($header, $rows) {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF"); // UTF-8 BOM so Excel shows names with ñ correctly
            fputcsv($out, $header);
            foreach ($rows as $row) {
                fputcsv($out, array_map([self::class, 'cell'], $row));
            }
            fclose($out);
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Cache-Control' => 'no-store',
        ]);
    }

    /**
     * Text that a spreadsheet would run as a formula (=, +, -, @, tab, CR)
     * is prefixed with an apostrophe: names and notes come from users.
     */
    public static function cell(mixed $value): string
    {
        $text = $value === null ? '' : (is_bool($value) ? ($value ? 'Yes' : 'No') : (string) $value);

        return $text !== '' && str_contains("=+-@\t\r", $text[0]) ? "'".$text : $text;
    }
}
