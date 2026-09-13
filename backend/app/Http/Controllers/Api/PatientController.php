<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class PatientController extends Controller
{
    /**
     * Get the authenticated patient's profile
     */
    public function profile(Request $request)
    {
        $user = $request->user()->load('patient');

        return response()->json([
            'success' => true,
            'data' => [
                'name' => $user->name,
                'email' => $user->email,
                'phone' => $user->patient->phone ?? null,
                'address' => $user->patient->address ?? null,
                'birth_date' => $user->patient->birth_date ?? null,
                'gender' => $user->patient->gender ?? null,
            ],
        ]);
    }

    /**
     * Update the authenticated patient's profile
     */
    public function updateProfile(Request $request)
    {
        $user = $request->user();

        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|string|max:255',
            'email' => 'sometimes|email|unique:users,email,' . $user->id,
            'phone' => 'sometimes|string|max:20',
            'address' => 'sometimes|string|max:255',
            'birth_date' => 'sometimes|date',
            'gender' => 'sometimes|in:male,female,other',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
            ], 422);
        }

        $user->update($request->only('name', 'email'));

        if ($user->patient) {
            $user->patient->update($request->only('phone', 'address', 'birth_date', 'gender'));
        }

        $user->load('patient');

        return response()->json([
            'success' => true,
            'message' => 'Profile updated successfully',
            'data' => [
                'name' => $user->name,
                'email' => $user->email,
                'phone' => $user->patient->phone ?? null,
                'address' => $user->patient->address ?? null,
                'birth_date' => $user->patient->birth_date ?? null,
                'gender' => $user->patient->gender ?? null,
            ],
        ]);
    }
}
