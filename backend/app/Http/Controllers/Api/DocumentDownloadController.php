<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\VerificationDocument;
use Illuminate\Support\Facades\Storage;

/**
 * Streams a private verification document. Reachable only through a
 * short-lived signed link handed out to an authorized user
 * (route middleware: signed:relative).
 */
class DocumentDownloadController extends Controller
{
    public function __invoke(VerificationDocument $document)
    {
        $disk = Storage::disk(VerificationDocument::DISK);
        abort_unless($disk->exists($document->path), 404);

        return $disk->response($document->path, $document->original_name, [
            'Content-Type' => $document->mime_type,
            'Cache-Control' => 'private, no-store',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }
}
