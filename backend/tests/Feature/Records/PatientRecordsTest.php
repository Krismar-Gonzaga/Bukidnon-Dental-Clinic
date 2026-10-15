<?php

namespace Tests\Feature\Records;

use App\Models\AuditLog;
use App\Models\PatientRecord;
use Illuminate\Foundation\Testing\RefreshDatabase;
use LogicException;
use Tests\Support\ClinicWorld;
use Tests\TestCase;

class PatientRecordsTest extends TestCase
{
    use ClinicWorld, RefreshDatabase;

    private array $world;

    private $patientUser;

    private int $patientId;

    protected function setUp(): void
    {
        parent::setUp();
        $this->freezeClock();
        $this->world = $this->makeClinic();
        $this->patientUser = $this->makePatient();
        $this->patientId = $this->patientUser->patient->id;
        $this->book($this->patientUser, $this->world)->assertCreated();
    }

    private function recordsUrl(string $suffix = ''): string
    {
        return $this->manage($this->world, "/patients/{$this->patientId}/records{$suffix}");
    }

    private function createRecord(array $overrides = [])
    {
        return $this->asUser($this->world['dentistUser'])->postJson($this->recordsUrl(), $overrides + [
            'record_type' => 'treatment',
            'findings' => 'Mild gingivitis',
            'procedures' => 'Scaling and polishing',
            'notes' => 'Internal: monitor tooth 36',
            'care_instructions' => 'Brush twice daily, floss nightly.',
        ]);
    }

    public function test_dentist_creates_and_reads_records_and_reads_are_audited(): void
    {
        $this->createRecord()->assertCreated()->assertJsonPath('data.dentist', $this->world['dentistUser']->name);

        $this->asUser($this->world['dentistUser'])->getJson($this->recordsUrl())->assertOk()->assertJsonCount(1, 'data');
        $this->assertTrue(AuditLog::where('action', 'records.viewed')->where('subject_id', $this->patientId)->exists());
    }

    public function test_receptionist_and_clinic_admin_cannot_access_clinical_records(): void
    {
        $this->createRecord()->assertCreated();

        foreach (['staff', 'admin'] as $who) {
            $this->asUser($this->world[$who])->getJson($this->recordsUrl())->assertForbidden();
            $this->asUser($this->world[$who])->postJson($this->recordsUrl(), ['record_type' => 'treatment'])->assertForbidden();
            $this->asUser($this->world[$who])->getJson($this->manage($this->world, "/patients/{$this->patientId}/medical-history"))->assertForbidden();
        }
    }

    public function test_other_clinic_cannot_read_records_even_with_correct_ids(): void
    {
        $this->createRecord()->assertCreated();
        $other = $this->makeClinic();

        $this->asUser($other['dentistUser'])->getJson($this->manage($other, "/patients/{$this->patientId}/records"))->assertNotFound();
        $this->asUser($other['dentistUser'])->getJson($this->recordsUrl())->assertNotFound();
    }

    public function test_dentist_without_an_appointment_with_the_patient_cannot_see_them(): void
    {
        $other = $this->makeClinic();
        // Same clinic, but a different dentist: add a second dentist to this clinic.
        $second = \App\Models\User::factory()->role('dentist')->memberOf($this->world['clinic'], 'dentist')->create();
        $profile = new \App\Models\Dentist(['is_active' => true]);
        $profile->user_id = $second->id;
        $profile->save();

        $this->asUser($second)->getJson($this->recordsUrl())->assertNotFound();
        $this->asUser($second)->getJson($this->manage($this->world, "/patients/{$this->patientId}"))->assertNotFound();
    }

    public function test_corrections_create_amendments_and_preserve_history(): void
    {
        $id = $this->createRecord()->json('data.id');

        $this->asUser($this->world['dentistUser'])->postJson($this->recordsUrl("/{$id}/amend"), [
            'record_type' => 'treatment',
            'findings' => 'Moderate gingivitis',
            'procedures' => 'Scaling and polishing',
        ])->assertStatus(422); // reason required

        $amendedId = $this->asUser($this->world['dentistUser'])->postJson($this->recordsUrl("/{$id}/amend"), [
            'record_type' => 'treatment',
            'findings' => 'Moderate gingivitis',
            'procedures' => 'Scaling and polishing',
            'amendment_reason' => 'Severity recorded incorrectly',
        ])->assertOk()->assertJsonPath('data.amends_record_id', $id)->json('data.id');

        $current = $this->asUser($this->world['dentistUser'])->getJson($this->recordsUrl())->json('data');
        $this->assertSame([$amendedId], array_column($current, 'id'));

        $all = $this->asUser($this->world['dentistUser'])->getJson($this->recordsUrl('?include_superseded=1'))->json('data');
        $this->assertCount(2, $all);
        $this->assertSame('Mild gingivitis', PatientRecord::find($id)->findings);
    }

    public function test_records_cannot_be_edited_or_deleted_in_place(): void
    {
        $record = PatientRecord::find($this->createRecord()->json('data.id'));

        try {
            $record->update(['findings' => 'tampered']);
            $this->fail('Edit was allowed');
        } catch (LogicException) {
        }

        $this->expectException(LogicException::class);
        $record->delete();
    }

    public function test_patient_sees_only_shared_care_instructions_not_internal_notes(): void
    {
        $this->createRecord(['is_patient_visible' => true])->assertCreated();
        $this->createRecord(['is_patient_visible' => false, 'care_instructions' => 'Hidden'])->assertCreated();

        $records = $this->asUser($this->patientUser)->getJson('/api/patient/records')->assertOk()->json('data');

        $this->assertCount(1, $records);
        $this->assertSame('Brush twice daily, floss nightly.', $records[0]['care_instructions']);
        $this->assertArrayNotHasKey('notes', $records[0]);
        $this->assertArrayNotHasKey('findings', $records[0]);
    }

    public function test_medical_history_is_append_only_with_current_entry_first(): void
    {
        $url = $this->manage($this->world, "/patients/{$this->patientId}/medical-history");

        $this->asUser($this->world['dentistUser'])->postJson($url, ['allergies' => 'Penicillin'])->assertCreated();
        $this->travel(1)->minutes();
        $this->asUser($this->world['dentistUser'])->postJson($url, ['allergies' => 'Penicillin, latex'])->assertCreated();

        $this->asUser($this->world['dentistUser'])->getJson($url)->assertOk()
            ->assertJsonPath('data.current.allergies', 'Penicillin, latex')
            ->assertJsonPath('data.history.0.allergies', 'Penicillin');
    }
}
