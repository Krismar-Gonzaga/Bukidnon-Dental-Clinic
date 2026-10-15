<?php

/*
| Browsers may call the API only from these origins (the web app, and the
| Expo web preview when used). Native mobile apps are not subject to CORS.
| Set CORS_ALLOWED_ORIGINS to a comma-separated list per environment.
*/

return [

    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    'allowed_origins' => array_values(array_filter(array_map(
        'trim',
        explode(',', (string) env('CORS_ALLOWED_ORIGINS', 'http://localhost:3000,http://127.0.0.1:3000'))
    ))),

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    // Needed for the web app's session cookie. Safe because allowed_origins
    // is an explicit list (never "*").
    'supports_credentials' => true,

];
