<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\BusinessTime;
use Illuminate\Http\Request;

/** In-app notification center for any signed-in user. */
class NotificationController extends Controller
{
    /** Everything a clinic member or system administrator can switch on or off; anything missing counts as on. */
    private const CATEGORIES = [
        'appointment_requests',
        'appointment_confirmations',
        'appointment_cancellations',
        'appointment_reminders',
        'check_in_alerts',
        'follow_ups',
        'schedule_updates',
        'patient_flags',
        'daily_summary',
        'inventory_low_stock',
        'inventory_critical',
        'inventory_expiry',
        'team_dentists',
        'team_staff',
        'team_password_resets',
        'subscription_renewal',
        'new_reviews',
        'monthly_reports',
        'system_announcements',
        'admin_new_clinic_registrations',
        'admin_verification_requests',
        'admin_payment_submissions',
        'admin_system_alerts',
    ];

    public function index(Request $request)
    {
        $user = $request->user();

        $page = $user->notifications()
            ->when($request->boolean('unread'), fn ($q) => $q->whereNull('read_at'))
            ->paginate($this->perPage($request, 20));

        return $this->ok(
            collect($page->items())->map(fn ($n) => [
                'id' => $n->id,
                ...$n->data,
                'read_at' => BusinessTime::iso($n->read_at),
                'created_at' => BusinessTime::iso($n->created_at),
            ]),
            meta: [
                'current_page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
                'per_page' => $page->perPage(),
                'total' => $page->total(),
                'unread_count' => $user->unreadNotifications()->count(),
            ]
        );
    }

    public function preferences(Request $request)
    {
        return $this->ok($request->user()->notification_preferences ?? (object) []);
    }

    public function markRead(Request $request, string $id)
    {
        $notification = $request->user()->notifications()->findOrFail($id);
        $notification->markAsRead();

        return $this->ok(message: 'Notification marked as read');
    }

    public function markAllRead(Request $request)
    {
        $request->user()->unreadNotifications()->update(['read_at' => now()]);

        return $this->ok(message: 'All notifications marked as read');
    }

    public function updatePreferences(Request $request)
    {
        $data = $request->validate([
            'email' => ['sometimes', 'boolean'],
            'categories' => ['sometimes', 'array:'.implode(',', self::CATEGORIES)],
            'categories.*' => ['boolean'],
        ]);
        $user = $request->user();
        $current = $user->notification_preferences ?? [];

        $user->forceFill([
            'notification_preferences' => [
                ...$current,
                ...$data,
                'categories' => [...($current['categories'] ?? []), ...($data['categories'] ?? [])],
            ],
        ])->save();

        return $this->ok($user->notification_preferences, 'Notification preferences saved');
    }
}
