<?php

namespace App\Support;

/**
 * A one-page text PDF, enough for an invoice, without a PDF package. Standard Helvetica
 * has no peso sign, so amounts are written as "PHP 1,500.00".
 */
class SimplePdf
{
    private const LEFT = 60;

    private const TOP = 780;

    private const LINE_HEIGHT = 20;

    /** @param list<string|array{0: string, 1: bool}> $lines Text, or [text, true] for a heading. */
    public static function render(array $lines): string
    {
        $content = 'BT '.self::LINE_HEIGHT.' TL '.self::LEFT.' '.self::TOP." Td\n";
        foreach ($lines as $line) {
            [$text, $heading] = is_array($line) ? $line : [$line, false];
            $content .= ($heading ? '/F2 16' : '/F1 11').' Tf ('.self::escape($text).") Tj T*\n";
        }
        $content .= 'ET';

        $objects = [
            '<< /Type /Catalog /Pages 2 0 R >>',
            '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
            '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>',
            '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
            '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
            '<< /Length '.strlen($content)." >>\nstream\n{$content}\nendstream",
        ];

        $pdf = "%PDF-1.4\n";
        $offsets = [];
        foreach ($objects as $index => $object) {
            $offsets[] = strlen($pdf);
            $pdf .= ($index + 1)." 0 obj\n{$object}\nendobj\n";
        }

        $xref = strlen($pdf);
        $pdf .= 'xref'."\n0 ".(count($objects) + 1)."\n0000000000 65535 f \n";
        foreach ($offsets as $offset) {
            $pdf .= sprintf("%010d 00000 n \n", $offset);
        }

        return $pdf.'trailer << /Size '.(count($objects) + 1)." /Root 1 0 R >>\nstartxref\n{$xref}\n%%EOF";
    }

    private static function escape(string $text): string
    {
        // Helvetica's encoding: anything else becomes "?" rather than broken bytes.
        $encoded = iconv('UTF-8', 'Windows-1252//TRANSLIT//IGNORE', $text) ?: '';

        return strtr($encoded, ['\\' => '\\\\', '(' => '\\(', ')' => '\\)']);
    }
}
