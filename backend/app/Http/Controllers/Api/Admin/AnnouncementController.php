<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\SystemAnnouncement;
use App\Notifications\PortalNotice;
use App\Services\AuditLogger;
use App\Support\BusinessTime;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

/** System Notifications: announcements. Publishing sends one to everyone in its audience. */
class AnnouncementController extends Controller
{
    private const RECIPIENT_CHUNK = 200;

    public function __construct(private readonly AuditLogger $audit)
    {
    }

    public function index(Request $request)
    {
        $request->validate(['status' => ['nullable', Rule::in([SystemAnnouncement::DRAFT, SystemAnnouncement::PUBLISHED, SystemAnnouncement::ARCHIVED])]]);

        $page = SystemAnnouncement::query()
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->status))
            ->orderByRaw("CASE status WHEN 'published' THEN 0 WHEN 'draft' THEN 1 ELSE 2 END")
            ->latest()->latest('id')
            ->paginate($this->perPage($request, 20));

        return $this->paginated($page, fn (SystemAnnouncement $announcement) => $this->present($announcement));
    }

    public function show(SystemAnnouncement $announcement)
    {
        return $this->ok($this->present($announcement));
    }

    public function store(Request $request)
    {
        $data = $request->validate([...$this->rules(), 'publish' => ['sometimes', 'boolean']]);

        $announcement = new SystemAnnouncement($data);
        $announcement->status = SystemAnnouncement::DRAFT;
        $announcement->created_by = $request->user()->id;
        $announcement->save();
        $this->audit->record('announcement.created', $announcement, ['audience' => $announcement->audience]);

        if ($request->boolean('publish')) {
            $this->send($announcement);
        }

        return $this->ok($this->present($announcement), $request->boolean('publish') ? 'Announcement published' : 'Draft saved', 201);
    }

    /** Only drafts change: what was sent to people stays as it was sent. */
    public function update(Request $request, SystemAnnouncement $announcement)
    {
        if ($announcement->status !== SystemAnnouncement::DRAFT) {
            throw new ConflictHttpException('Only drafts can be edited.');
        }
        $data = $request->validate([...$this->rules(), 'publish' => ['sometimes', 'boolean']]);

        $announcement->update($data);
        $this->audit->record('announcement.updated', $announcement);

        if ($request->boolean('publish')) {
            $this->send($announcement);
        }

        return $this->ok($this->present($announcement), $request->boolean('publish') ? 'Announcement published' : 'Draft saved');
    }

    public function publish(SystemAnnouncement $announcement)
    {
        if ($announcement->status !== SystemAnnouncement::DRAFT) {
            throw new ConflictHttpException('Only drafts can be published.');
        }
        $this->send($announcement);

        return $this->ok($this->present($announcement), 'Announcement published');
    }

    /** Stops counting as active. People who already received it keep their notification. */
    public function archive(SystemAnnouncement $announcement)
    {
        if ($announcement->status !== SystemAnnouncement::PUBLISHED) {
            throw new ConflictHttpException('Only published announcements can be archived.');
        }
        $announcement->status = SystemAnnouncement::ARCHIVED;
        $announcement->archived_at = now();
        $announcement->save();
        $this->audit->record('announcement.archived', $announcement);

        return $this->ok($this->present($announcement), 'Announcement archived');
    }

    private function send(SystemAnnouncement $announcement): void
    {
        $announcement->status = SystemAnnouncement::PUBLISHED;
        $announcement->published_at = now();
        $announcement->save();

        $notice = new PortalNotice('announcement', $announcement->title, Str::limit($announcement->content, 500), 'system_announcements');
        $sent = 0;
        $announcement->recipients()->chunkById(self::RECIPIENT_CHUNK, function ($users) use ($notice, &$sent) {
            Notification::send($users, $notice);
            $sent += $users->count();
        });

        $this->audit->record('announcement.published', $announcement, ['audience' => $announcement->audience, 'rows' => $sent]);
    }

    private function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:150'],
            'content' => ['required', 'string', 'max:5000'],
            'audience' => ['required', Rule::in(array_keys(SystemAnnouncement::AUDIENCES))],
        ];
    }

    private function present(SystemAnnouncement $announcement): array
    {
        return [
            'id' => $announcement->id,
            'title' => $announcement->title,
            'content' => $announcement->content,
            'audience' => $announcement->audience,
            'status' => $announcement->status,
            'published_at' => BusinessTime::iso($announcement->published_at),
            'archived_at' => BusinessTime::iso($announcement->archived_at),
            'created_at' => BusinessTime::iso($announcement->created_at),
        ];
    }
}
