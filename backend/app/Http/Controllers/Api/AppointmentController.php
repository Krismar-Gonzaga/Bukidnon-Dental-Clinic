<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Appointment;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class AppointmentController extends Controller
{
    /**
     * List the authenticated patient's appointments.
     *
     * The appointments table has no patient_id/user_id column (it stores
     * denormalized patient_name/email/phone), so appointments are matched
     * to the authenticated user by email.
     */
    public function patientAppointments(Request $request)
    {
        $user = $request->user();

        $appointments = Appointment::with('clinic')
            ->where('patient_email', $user->email)
            ->orderBy('appointment_date', 'desc')
            ->orderBy('appointment_time', 'desc')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $appointments,
        ]);
    }

    /**
     * Book a new appointment for the authenticated patient.
     */
    public function store(Request $request)
    {
        $user = $request->user()->load('patient');

        $validator = Validator::make($request->all(), [
            'clinic_id' => 'required|exists:clinics,id',
            'service_id' => 'nullable|exists:services,id',
            'appointment_date' => 'required|date|after_or_equal:today',
            'appointment_time' => 'required',
            'reason' => 'nullable|string|max:255',
            'notes' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
            ], 422);
        }

        $notes = trim(collect([$request->reason, $request->notes])->filter()->implode(' — '));

        $appointment = Appointment::create([
            'clinic_id' => $request->clinic_id,
            'service_id' => $request->service_id,
            'patient_name' => $user->name,
            'patient_email' => $user->email,
            'patient_phone' => $user->patient->phone ?? '',
            'appointment_date' => $request->appointment_date,
            'appointment_time' => $request->appointment_time,
            'status' => 'pending',
            'notes' => $notes !== '' ? $notes : null,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Appointment booked successfully',
            'data' => $appointment->load('clinic'),
        ], 201);
    }

    /**
     * Update one of the authenticated patient's own appointments.
     */
    public function update(Request $request, $id)
    {
        $user = $request->user();
        $appointment = Appointment::where('patient_email', $user->email)->findOrFail($id);

        $validator = Validator::make($request->all(), [
            'appointment_date' => 'sometimes|date|after_or_equal:today',
            'appointment_time' => 'sometimes',
            'notes' => 'sometimes|nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
            ], 422);
        }

        $appointment->update($request->only('appointment_date', 'appointment_time', 'notes'));

        return response()->json([
            'success' => true,
            'message' => 'Appointment updated successfully',
            'data' => $appointment->load('clinic'),
        ]);
    }

    /**
     * Cancel one of the authenticated patient's own appointments.
     */
    public function cancel(Request $request, $id)
    {
        $user = $request->user();
        $appointment = Appointment::where('patient_email', $user->email)->findOrFail($id);
        $appointment->update(['status' => 'cancelled']);

        return response()->json([
            'success' => true,
            'message' => 'Appointment cancelled successfully',
        ]);
    }
}
