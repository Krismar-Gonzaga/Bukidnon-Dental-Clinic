<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\ClinicApplication;
use App\Services\AuditLogger;
use App\Support\PlatformSettings;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** System Settings: the values, what they apply to, and the plans on offer. */
class SettingsController extends Controller
{
    public function __construct(private readonly AuditLogger $audit)
    {
    }

    public function show()
    {
        return $this->ok($this->payload());
    }

    public function update(Request $request)
    {
        $data = $request->validate([
            'platform_name' => ['sometimes', 'required', 'string', 'max:80'],
            'support_email' => ['sometimes', 'required', 'email', 'max:255'],
            'maintenance_mode' => ['sometimes', 'boolean'],
            'allow_self_registration' => ['sometimes', 'boolean'],
            'session_timeout_minutes' => ['sometimes', 'integer', 'min:'.PlatformSettings::MIN_SESSION_MINUTES, 'max:'.PlatformSettings::MAX_SESSION_MINUTES],
            'require_verification' => ['sometimes', 'boolean'],
            'required_documents' => ['sometimes', 'array', 'min:1'],
            'required_documents.*' => ['string', Rule::in(ClinicApplication::REQUIRED_DOCUMENTS)],
            'payment_grace_days' => ['sometimes', 'integer', 'min:0', 'max:'.PlatformSettings::MAX_GRACE_DAYS],
        ]);

        if (isset($data['required_documents'])) {
            $data['required_documents'] = array_values(array_intersect(ClinicApplication::REQUIRED_DOCUMENTS, $data['required_documents']));
        }

        $changed = PlatformSettings::update($data);

        if ($changed !== []) {
            $this->audit->record('settings.updated', metadata: ['changed' => array_keys($changed)]);
        }

        return $this->ok($this->payload(), 'Settings saved');
    }

    private function payload(): array
    {
        return [
            ...PlatformSettings::all(),
            'document_types' => ClinicApplication::REQUIRED_DOCUMENTS,
            'plans' => collect(config('subscriptions.plans'))
                ->reject(fn (array $plan) => $plan['retired'] ?? false)
                ->map(fn (array $plan, string $key) => [
                    'key' => $key,
                    'name' => $plan['name'],
                    'price' => $plan['price'],
                    'limits' => $plan['limits'] ?? null,
                ])
                ->values(),
        ];
    }
}
