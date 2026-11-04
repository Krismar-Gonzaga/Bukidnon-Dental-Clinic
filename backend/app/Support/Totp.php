<?php

namespace App\Support;

/**
 * Time-based one-time passwords (RFC 6238, the codes authenticator apps show): 6 digits,
 * 30 seconds, SHA-1. Written here because it is short and needs no extra package.
 */
class Totp
{
    private const PERIOD = 30;

    private const DIGITS = 6;

    // One period either way, for phones whose clock is slightly off.
    private const WINDOW = 1;

    private const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

    public static function generateSecret(int $bytes = 20): string
    {
        return self::base32Encode(random_bytes($bytes));
    }

    public static function verify(string $secret, string $code, ?int $now = null): bool
    {
        return self::matchingCounter($secret, $code, $now) !== null;
    }

    /** Which time period this code belongs to, or null when it is not valid now. */
    public static function matchingCounter(string $secret, string $code, ?int $now = null): ?int
    {
        if ($secret === '' || ! preg_match('/^\d{'.self::DIGITS.'}$/', $code)) {
            return null;
        }

        $counter = (int) floor(($now ?? time()) / self::PERIOD);
        foreach (range(-self::WINDOW, self::WINDOW) as $offset) {
            if (hash_equals(self::code($secret, $counter + $offset), $code)) {
                return $counter + $offset;
            }
        }

        return null;
    }

    public static function code(string $secret, int $counter): string
    {
        $hash = hash_hmac('sha1', pack('J', $counter), self::base32Decode($secret), true);
        $offset = ord($hash[19]) & 0x0F;
        $value = unpack('N', substr($hash, $offset, 4))[1] & 0x7FFFFFFF;

        return str_pad((string) ($value % (10 ** self::DIGITS)), self::DIGITS, '0', STR_PAD_LEFT);
    }

    /** The link authenticator apps understand. */
    public static function uri(string $secret, string $account, string $issuer): string
    {
        return sprintf(
            'otpauth://totp/%s:%s?secret=%s&issuer=%s&period=%d&digits=%d',
            rawurlencode($issuer),
            rawurlencode($account),
            $secret,
            rawurlencode($issuer),
            self::PERIOD,
            self::DIGITS,
        );
    }

    private static function base32Encode(string $bytes): string
    {
        $bits = '';
        foreach (str_split($bytes) as $byte) {
            $bits .= str_pad(decbin(ord($byte)), 8, '0', STR_PAD_LEFT);
        }

        $encoded = '';
        foreach (str_split($bits, 5) as $chunk) {
            $encoded .= self::ALPHABET[bindec(str_pad($chunk, 5, '0'))];
        }

        return $encoded;
    }

    private static function base32Decode(string $secret): string
    {
        $bits = '';
        foreach (str_split(strtoupper($secret)) as $character) {
            $position = strpos(self::ALPHABET, $character);
            if ($position !== false) {
                $bits .= str_pad(decbin($position), 5, '0', STR_PAD_LEFT);
            }
        }

        $bytes = '';
        foreach (str_split($bits, 8) as $chunk) {
            if (strlen($chunk) === 8) {
                $bytes .= chr(bindec($chunk));
            }
        }

        return $bytes;
    }
}
