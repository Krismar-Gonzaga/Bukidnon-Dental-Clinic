<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>@yield('title')</title>
    <style>
        :root { --navy: #003f87; --text: #1a1c20; --muted: #5b6472; --line: #e2e6ec; }
        * { box-sizing: border-box; }
        body { margin: 0; background: #f4f6fb; color: var(--text); font: 15px/1.55 Arial, Helvetica, sans-serif; }
        .sheet { max-width: 640px; margin: 24px auto; padding: 40px; background: #fff; border-radius: 12px; }
        .head { text-align: center; padding-bottom: 20px; border-bottom: 1px solid var(--line); }
        .clinic { margin: 0; color: var(--navy); font-size: 22px; font-weight: 700; text-transform: uppercase; letter-spacing: .02em; }
        .address { margin: 4px 0 12px; color: var(--muted); font-size: 13px; }
        .badge { display: inline-block; padding: 5px 16px; border-radius: 999px; background: var(--navy); color: #fff; font-size: 13px; font-weight: 700; text-transform: uppercase; }
        .body { padding: 24px 0; border-bottom: 1px solid var(--line); }
        .sign { padding-top: 56px; text-align: center; }
        .line { width: 200px; margin: 0 auto 6px; border-top: 1px solid var(--text); }
        .name { margin: 0; font-weight: 700; }
        .small { margin: 2px 0 0; color: var(--muted); font-size: 13px; }
        .row { margin: 0 0 8px; }
        .rx { margin: 0 0 12px; font-size: 18px; font-weight: 700; }
        .print { display: block; width: 100%; margin-top: 24px; padding: 12px; border: 0; border-radius: 8px; background: var(--navy); color: #fff; font: inherit; font-weight: 700; cursor: pointer; }
        @media (max-width: 680px) { .sheet { margin: 0; border-radius: 0; padding: 24px 16px; } }
        @media print { body { background: #fff; } .sheet { margin: 0; max-width: none; } .print { display: none; } }
    </style>
</head>
<body>
    <main class="sheet">
        @yield('content')
        <button type="button" class="print" onclick="window.print()">Print</button>
    </main>
</body>
</html>
