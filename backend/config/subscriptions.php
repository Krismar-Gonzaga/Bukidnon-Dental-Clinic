<?php

/*
| PROVISIONAL plan and payment details from the design's sample content. Confirm the
| price and set the real accounts in .env before accepting payments: there is no online
| payment, patients of the platform transfer manually and upload proof.
*/
return [

    'default_plan' => 'professional',

    /*
    | Offered plans, from the system admin design (sample prices). "limits" is shown to
    | administrators; the numbers are not enforced. A plan marked "retired" keeps existing
    | subscriptions readable but is no longer offered.
    */
    'plans' => [
        'starter' => [
            'name' => 'Starter',
            'price' => 1999,
            'billing' => 'Monthly subscription',
            'limits' => '1 dentist, 1 branch',
            'features' => [
                'Unlimited Appointments',
                '1 Dentist',
                '1 Branch',
                'Patient Records',
            ],
        ],
        'professional' => [
            'name' => 'Professional',
            'price' => 4999,
            'billing' => 'Monthly subscription',
            'limits' => '5 dentists, 3 branches',
            'features' => [
                'Unlimited Appointments',
                'Up to 5 Dentists',
                'Up to 3 Branches',
                'Inventory Management',
                'Analytics & Reports',
                'Patient Records',
                'Priority Support',
            ],
        ],
        'enterprise' => [
            'name' => 'Enterprise',
            'price' => 9999,
            'billing' => 'Monthly subscription',
            'limits' => 'Unlimited dentists & branches',
            'features' => [
                'Unlimited Appointments',
                'Unlimited Dentists',
                'Unlimited Branches',
                'Inventory Management',
                'Analytics & Reports',
                'Patient Records',
                'Priority Support',
            ],
        ],
        'pro' => [
            'name' => 'Pro Plan',
            'retired' => true,
            'price' => 1500,
            'billing' => 'Monthly subscription',
            'features' => [
                'Unlimited Appointments',
                'Up to 5 Dentists',
                'Inventory Management',
                'Analytics & Reports',
                'Patient Records',
                'Priority Support',
            ],
        ],
    ],

    'channels' => [
        'gcash' => [
            'label' => 'GCash',
            'number_label' => 'GCash Number',
            'number' => env('PAYMENT_GCASH_NUMBER', '09XX XXX XXXX'),
            'account_name' => env('PAYMENT_ACCOUNT_NAME', 'BukidnonDental Inc.'),
        ],
        'maya' => [
            'label' => 'Maya',
            'number_label' => 'Maya Number',
            'number' => env('PAYMENT_MAYA_NUMBER', '09XX XXX XXXX'),
            'account_name' => env('PAYMENT_ACCOUNT_NAME', 'BukidnonDental Inc.'),
        ],
        'bank' => [
            'label' => 'Bank Transfer',
            'number_label' => 'Account Number',
            'number' => env('PAYMENT_BANK_ACCOUNT', 'XXXX XXXX XXXX'),
            'account_name' => env('PAYMENT_ACCOUNT_NAME', 'BukidnonDental Inc.'),
        ],
    ],

];
