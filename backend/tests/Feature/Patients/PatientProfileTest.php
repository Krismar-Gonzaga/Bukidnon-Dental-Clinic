<?php

namespace Tests\Feature\Patients;

use App\Models\AuditLog;
use App\Models\Patient;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Tests\Support\ClinicWorld;
use Tests\TestCase;

class PatientProfileTest extends TestCase
{
    use ClinicWorld, RefreshDatabase;

    private const HEALTH = [
        'conditions' => ['Hypertension'],
        'allergies' => [['name' => 'Penicillin', 'type' => 'drug', 'severity' => 'severe', 'reaction' => 'Hives']],
        'medications' => [['name' => 'Amlodipine', 'dosage' => '5mg once daily', 'purpose' => 'Hypertension']],
        'anxiety' => ['level' => 3, 'sedation' => 'Local anesthesia only'],
    ];

    protected function setUp(): void
    {
        parent::setUp();
        $this->freezeClock();
    }

    public function test_patient_saves_their_details_and_sections_merge(): void
    {
        $user = $this->makePatient();

        $this->asUser($user)->putJson('/api/patient/profile', [
            'blood_type' => 'O+',
            'civil_status' => 'single',
            'city' => 'Valencia City',
            'province' => 'Bukidnon',
            'zip_code' => '8709',
            'emergency_contact_relationship' => 'Mother',
        ])->assertOk()->assertJsonPath('data.blood_type', 'O+')->assertJsonPath('data.city', 'Valencia City');

        $this->asUser($user)->putJson('/api/patient/profile/health', self::HEALTH)->assertOk()
            ->assertJsonPath('data.health.allergies.0.name', 'Penicillin');
        $this->asUser($user)->putJson('/api/patient/profile/health', ['conditions' => ['Asthma']])->assertOk()
            ->assertJsonPath('data.health.conditions.0', 'Asthma')
            ->assertJsonPath('data.health.medications.0.name', 'Amlodipine');
    }

    public function test_invalid_health_details_and_unknown_consents_are_rejected(): void
    {
        $user = $this->makePatient();

        $this->asUser($user)->putJson('/api/patient/profile', ['blood_type' => 'Z+'])->assertJsonValidationErrors('blood_type');
        $this->asUser($user)->putJson('/api/patient/profile', ['consents' => ['marketing_sold' => true]])->assertJsonValidationErrors('consents');
        $this->asUser($user)->putJson('/api/patient/profile/health', [
            'allergies' => [['name' => 'Latex', 'type' => 'drug', 'severity' => 'deadly']],
        ])->assertJsonValidationErrors('allergies.0.severity');
        $this->asUser($user)->putJson('/api/patient/profile/health', ['anxiety' => ['level' => 9]])->assertJsonValidationErrors('anxiety.level');
    }

    public function test_health_details_are_encrypted_at_rest_and_never_in_general_user_payloads(): void
    {
        $user = $this->makePatient();
        $this->asUser($user)->putJson('/api/patient/profile/health', self::HEALTH)->assertOk();

        $stored = DB::table('patients')->where('user_id', $user->id)->value('health_profile');
        $this->assertStringNotContainsString('Penicillin', $stored);
        $this->assertSame('Penicillin', Patient::where('user_id', $user->id)->first()->health_profile['allergies'][0]['name']);

        $this->asUser($user)->getJson('/api/user')->assertOk()->assertDontSee('Penicillin');
    }

    public function test_the_audit_log_records_changes_without_health_content(): void
    {
        $user = $this->makePatient();
        $this->asUser($user)->putJson('/api/patient/profile/health', self::HEALTH)->assertOk();
        $this->asUser($user)->putJson('/api/patient/profile', ['consents' => ['share_medical_history' => true]])->assertOk();

        $health = AuditLog::where('action', 'patient.health_profile_updated')->firstOrFail();
        $this->assertStringNotContainsString('Penicillin', json_encode($health->toArray()));
        $this->assertSame(['share_medical_history'], AuditLog::where('action', 'patient.consents_changed')->firstOrFail()->metadata['consents']);
    }

    public function test_consents_are_off_until_the_patient_turns_them_on(): void
    {
        $user = $this->makePatient();

        $this->asUser($user)->getJson('/api/patient/profile')->assertOk()
            ->assertJsonPath('data.consents.share_medical_history', false)
            ->assertJsonPath('data.consents.promotions', false);

        $this->asUser($user)->putJson('/api/patient/profile', ['consents' => ['promotions' => true]])->assertOk()
            ->assertJsonPath('data.consents.promotions', true)
            ->assertJsonPath('data.consents.share_medical_history', false);
    }

    public function test_a_clinic_sees_patient_reported_health_only_with_consent(): void
    {
        $world = $this->makeClinic();
        $user = $this->makePatient();
        $this->book($user, $world)->assertCreated();
        $patientId = $user->patient->id;
        $url = $this->manage($world, "/patients/{$patientId}/medical-history");

        $this->asUser($user)->putJson('/api/patient/profile', ['blood_type' => 'O+'])->assertOk();
        $this->asUser($user)->putJson('/api/patient/profile/health', self::HEALTH)->assertOk();

        $this->asUser($world['dentistUser'])->getJson($url)->assertOk()
            ->assertJsonPath('data.patient_reported', null)
            ->assertDontSee('Penicillin');

        $this->asUser($user)->putJson('/api/patient/profile', ['consents' => ['share_medical_history' => true]])->assertOk();

        $this->asUser($world['dentistUser'])->getJson($url)->assertOk()
            ->assertJsonPath('data.patient_reported.blood_type', 'O+')
            ->assertJsonPath('data.patient_reported.allergies.0.name', 'Penicillin');

        // Consent does not widen who may look: another clinic still cannot see this patient.
        $other = $this->makeClinic();
        $this->asUser($other['dentistUser'])
            ->getJson($this->manage($other, "/patients/{$patientId}/medical-history"))
            ->assertNotFound();
    }

    public function test_photo_is_private_to_its_owner_and_replaces_the_old_one(): void
    {
        Storage::fake(Patient::PHOTO_DISK);
        $user = $this->makePatient();

        $first = $this->asUser($user)->post('/api/patient/profile/photo', [
            'photo' => UploadedFile::fake()->create('me.png', 100, 'image/png'),
        ], ['Accept' => 'application/json'])->assertOk()->json('data.photo_version');
        $this->assertNotNull($first);
        $firstPath = $user->patient->fresh()->photo_path;
        Storage::disk(Patient::PHOTO_DISK)->assertExists($firstPath);

        $this->asUser($user)->get('/api/patient/profile/photo')->assertOk()
            ->assertHeader('X-Content-Type-Options', 'nosniff');

        // Each patient only ever gets their own photo.
        $this->asUser($this->makePatient())->getJson('/api/patient/profile/photo')->assertNotFound();
        $this->flushHeaders();
        app('auth')->forgetGuards();
        $this->getJson('/api/patient/profile/photo')->assertUnauthorized();

        $second = $this->asUser($user)->post('/api/patient/profile/photo', [
            'photo' => UploadedFile::fake()->create('new.jpg', 100, 'image/jpeg'),
        ], ['Accept' => 'application/json'])->assertOk()->json('data.photo_version');
        $this->assertNotSame($first, $second);
        Storage::disk(Patient::PHOTO_DISK)->assertMissing($firstPath);
    }

    public function test_only_small_image_files_are_accepted_as_a_photo(): void
    {
        Storage::fake(Patient::PHOTO_DISK);
        $user = $this->makePatient();
        $upload = fn (UploadedFile $file) => $this->asUser($user)
            ->post('/api/patient/profile/photo', ['photo' => $file], ['Accept' => 'application/json']);

        $upload(UploadedFile::fake()->create('page.svg', 10, 'image/svg+xml'))->assertJsonValidationErrors('photo');
        $upload(UploadedFile::fake()->create('script.php', 10, 'application/x-php'))->assertJsonValidationErrors('photo');
        $upload(UploadedFile::fake()->create('huge.png', 3000, 'image/png'))->assertJsonValidationErrors('photo');
    }

    public function test_dashboard_counts_include_the_total(): void
    {
        $world = $this->makeClinic();
        $user = $this->makePatient();
        $this->book($user, $world)->assertCreated();

        $this->asUser($user)->getJson('/api/patient/dashboard')->assertOk()
            ->assertJsonPath('data.counts.total', 1)
            ->assertJsonPath('data.counts.pending', 1)
            ->assertJsonPath('data.counts.completed', 0);
    }
}
