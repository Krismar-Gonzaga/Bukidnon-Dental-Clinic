<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\BusinessTime;
use Illuminate\Http\Request;

/** In-app notification center for any signed-in user. */
class NotificationController extends Controller
{
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
        $data = $request->validate(['email' => ['required', 'boolean']]);
        $user = $request->user();

        $user->forceFill([
            'notification_preferences' => array_merge($user->notification_preferences ?? [], $data),
        ])->save();

        return $this->ok($user->notification_preferences, 'Notification preferences saved');
    }
}
