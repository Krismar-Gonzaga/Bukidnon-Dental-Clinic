<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\ClinicVerification;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;

class ClinicVerificationController extends Controller
{
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'clinic_name' => 'required|string|max:255',
            'business_permit' => 'required|file|mimes:pdf,jpg,jpeg,png|max:5120',
            'doh_license' => 'required|file|mimes:pdf,jpg,jpeg,png|max:5120',
            'prc_id' => 'required|file|mimes:pdf,jpg,jpeg,png|max:5120',
            'bir_registration' => 'required|file|mimes:pdf,jpg,jpeg,png|max:5120',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $user = $request->user();

            // Check if user is clinic_admin
            if ($user->role !== 'clinic_admin') {
                return response()->json([
                    'success' => false,
                    'message' => 'Only clinic administrators can submit verification'
                ], 403);
            }

            // Check if already submitted
            $existing = ClinicVerification::where('user_id', $user->id)
                ->whereIn('status', ['pending', 'verified'])
                ->first();

            if ($existing) {
                return response()->json([
                    'success' => false,
                    'message' => 'You already have a pending or verified application'
                ], 400);
            }

            // Upload files
            $filePaths = [];
            $documents = ['business_permit', 'doh_license', 'prc_id', 'bir_registration'];

            foreach ($documents as $doc) {
                if ($request->hasFile($doc)) {
                    $file = $request->file($doc);
                    $path = $file->store("verifications/{$user->id}", 'public');
                    $filePaths[$doc] = $path;
                }
            }

            // Create verification record
            $verification = ClinicVerification::create([
                'user_id' => $user->id,
                'clinic_name' => $request->clinic_name,
                'business_permit' => $filePaths['business_permit'] ?? null,
                'doh_license' => $filePaths['doh_license'] ?? null,
                'prc_id' => $filePaths['prc_id'] ?? null,
                'bir_registration' => $filePaths['bir_registration'] ?? null,
                'status' => 'pending',
                'submitted_at' => now(),
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Verification documents submitted successfully',
                'data' => $verification
            ], 201);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to submit verification: ' . $e->getMessage()
            ], 500);
        }
    }

    public function status(Request $request)
    {
        $user = $request->user();
        $verification = ClinicVerification::where('user_id', $user->id)
            ->orderBy('created_at', 'desc')
            ->first();

        if (!$verification) {
            return response()->json([
                'success' => true,
                'data' => null,
                'message' => 'No verification found'
            ]);
        }

        return response()->json([
            'success' => true,
            'data' => $verification
        ]);
    }

    public function update(Request $request, $id)
    {
        $verification = ClinicVerification::findOrFail($id);

        // Only system admin can update status
        if ($request->user()->role !== 'system_admin') {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized'
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'status' => 'required|in:pending,verified,rejected',
            'rejection_reason' => 'required_if:status,rejected|string|nullable',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        $verification->update([
            'status' => $request->status,
            'rejection_reason' => $request->rejection_reason,
            'verified_at' => $request->status === 'verified' ? now() : null,
        ]);

        // If verified, create clinic
        if ($request->status === 'verified') {
            // Create clinic logic here
        }

        return response()->json([
            'success' => true,
            'message' => 'Verification status updated',
            'data' => $verification
        ]);
    }
}