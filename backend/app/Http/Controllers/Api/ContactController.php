<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Notifications\ContactMessageReceived;
use App\Services\AuditLogger;
use App\Support\PlatformSettings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Notification;
use Throwable;

/**
 * Public contact form. The message is emailed to the support address and not
 * stored; the audit log records only that one arrived. `website` is a hidden
 * field real visitors leave empty: bots that fill it get a normal answer and
 * nothing is sent. Names and subjects are single-line so they cannot add mail
 * headers.
 */
class ContactController extends Controller
{
    private const SINGLE_LINE = 'not_regex:/[\r\n]/';

    public function __construct(private readonly AuditLogger $audit)
    {
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'first_name' => ['required', 'string', 'max:100', self::SINGLE_LINE],
            'last_name' => ['required', 'string', 'max:100', self::SINGLE_LINE],
            'email' => ['required', 'email', 'max:255'],
            'subject' => ['required', 'string', 'max:150', self::SINGLE_LINE],
            'message' => ['required', 'string', 'max:5000'],
            'website' => ['nullable', 'string', 'max:255'],
        ]);

        if (! empty($data['website'])) {
            return $this->ok(null, 'Message sent', 201);
        }

        try {
            Notification::route('mail', PlatformSettings::get('support_email') ?: config('mail.contact_address'))->notifyNow(new ContactMessageReceived($data));
        } catch (Throwable $e) {
            report($e);

            return $this->fail('Your message could not be sent. Please try again or contact us by phone.', 503);
        }

        $this->audit->record('contact.message_received');

        return $this->ok(null, 'Message sent', 201);
    }
}
