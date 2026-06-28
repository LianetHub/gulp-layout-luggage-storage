<?php

declare(strict_types=1);

session_start();

const BOOKING_MAIL_TO = 'greenartspb@yandex.ru, gozi@mail.ru, opticoe@gmail.com';
const BOOKING_TOKEN_TTL = 900;

header('X-Content-Type-Options: nosniff');

function jsonResponse(array $data, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function cleanString($value, int $maxLength = 255): string
{
    $value = trim((string) $value);
    $value = preg_replace('/[\x00-\x1F\x7F]+/u', ' ', $value) ?? '';

    if (function_exists('mb_substr')) {
        return mb_substr($value, 0, $maxLength, 'UTF-8');
    }

    return substr($value, 0, $maxLength);
}

function formatMinutes(int $minutes): string
{
    $hours = intdiv($minutes, 60) % 24;
    $mins = $minutes % 60;

    return sprintf('%02d:%02d', $hours, $mins);
}

function tariffPrice(int $from, int $to): int
{
    $duration = $to - $from;

    if ($duration === 60 || $from >= 1080) {
        return (int) ceil($duration / 60) * 100;
    }

    $price = $duration <= 180 ? 200 : 300;

    if ($to > 1140) {
        $price += (int) ceil(($to - 1140) / 60) * 100;
    }

    return $price;
}

function parseItems(string $itemsJson, int $tariffPrice): array
{
    $decoded = json_decode($itemsJson, true);
    if (!is_array($decoded)) {
        throw new RuntimeException('Некорректный список вещей.');
    }

    $allowed = [
        'Ручная кладь' => ['price' => $tariffPrice],
        'Чемодан' => ['price' => $tariffPrice],
        'Негабарит' => ['price' => 800],
    ];

    $items = [];
    foreach ($decoded as $row) {
        if (!is_array($row)) {
            continue;
        }

        $name = cleanString($row['name'] ?? '', 80);
        if (!isset($allowed[$name])) {
            continue;
        }

        $qty = filter_var($row['qty'] ?? null, FILTER_VALIDATE_INT, [
            'options' => ['min_range' => 0, 'max_range' => 99],
        ]);
        if ($qty === false || $qty === 0) {
            continue;
        }

        $price = $allowed[$name]['price'];
        $items[] = [
            'name' => $name,
            'qty' => $qty,
            'price' => $price,
            'sum' => $qty * $price,
        ];
    }

    return $items;
}

if ($_SERVER['REQUEST_METHOD'] === 'GET' && ($_GET['action'] ?? '') === 'captcha') {
    $token = bin2hex(random_bytes(24));
    $_SESSION['booking_captcha'] = [
        'token' => hash('sha256', $token),
        'expires' => time() + BOOKING_TOKEN_TTL,
    ];
    jsonResponse(['success' => true, 'token' => $token]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['success' => false, 'message' => 'Метод не поддерживается.'], 405);
}

if (($_POST['website'] ?? '') !== '') {
    jsonResponse(['success' => true, 'message' => 'Заявка принята.']);
}

$captcha = (string) ($_POST['booking_captcha'] ?? '');
$captchaSession = $_SESSION['booking_captcha'] ?? null;
unset($_SESSION['booking_captcha']);

if (
    !is_array($captchaSession)
    || empty($captchaSession['token'])
    || empty($captchaSession['expires'])
    || (int) $captchaSession['expires'] < time()
    || !hash_equals((string) $captchaSession['token'], hash('sha256', $captcha))
) {
    jsonResponse(['success' => false, 'message' => 'Обновите страницу и повторите отправку.'], 400);
}

$name = cleanString($_POST['name'] ?? '', 120);
$phone = cleanString($_POST['phone'] ?? '', 40);
$phoneDigits = preg_replace('/\D+/', '', $phone) ?? '';
$date = cleanString($_POST['storage_date'] ?? '', 20);
$agree = isset($_POST['agree']);
$from = filter_var($_POST['time_from'] ?? null, FILTER_VALIDATE_INT);
$to = filter_var($_POST['time_to'] ?? null, FILTER_VALIDATE_INT);

$errors = [];
if ($name === '') {
    $errors[] = 'Укажите имя.';
}
if (!preg_match('/^(7|8)\d{10}$/', $phoneDigits)) {
    $errors[] = 'Укажите корректный телефон.';
}
if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
    $errors[] = 'Выберите дату хранения.';
}
if (!$agree) {
    $errors[] = 'Подтвердите согласие на обработку данных.';
}
if ($from === false || $to === false || $from < 540 || $to > 1440 || $to - $from < 60) {
    $errors[] = 'Выберите корректный интервал времени.';
}

if ($errors !== []) {
    jsonResponse(['success' => false, 'message' => implode(' ', $errors)], 422);
}

$tariffPrice = tariffPrice((int) $from, (int) $to);
try {
    $items = parseItems((string) ($_POST['items_json'] ?? '[]'), $tariffPrice);
} catch (Throwable $e) {
    jsonResponse(['success' => false, 'message' => $e->getMessage()], 422);
}

$totalQty = array_sum(array_column($items, 'qty'));
$total = array_sum(array_column($items, 'sum'));
if ($totalQty <= 0) {
    jsonResponse(['success' => false, 'message' => 'Добавьте хотя бы одну вещь.'], 422);
}

$escapeHtml = static fn($value): string => htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');

$itemLines = [];
foreach ($items as $item) {
    $itemLines[] = sprintf(
        '<li>%s — %d шт. × %d ₽ = %d ₽</li>',
        $escapeHtml($item['name']),
        $item['qty'],
        $item['price'],
        $item['sum']
    );
}

$subject = 'Бронирование locker39.ru';
$body = implode("\n", [
    '<!doctype html>',
    '<html lang="ru">',
    '<head><meta charset="UTF-8"><title>' . $escapeHtml($subject) . '</title></head>',
    '<body>',
    '<h2>Новая заявка на бронирование locker39.ru</h2>',
    '<p><b>Имя:</b> ' . $escapeHtml($name) . '</p>',
    '<p><b>Телефон:</b> ' . $escapeHtml($phone) . '</p>',
    '<p><b>Дата хранения:</b> ' . $escapeHtml($date) . '</p>',
    '<p><b>Время:</b> с ' . formatMinutes((int) $from) . ' до ' . formatMinutes((int) $to) . '</p>',
    '<p><b>Тариф за обычную единицу:</b> ' . $tariffPrice . ' ₽/шт.</p>',
    '<p><b>Вещи:</b></p>',
    '<ul>',
    implode("\n", $itemLines),
    '</ul>',
    '<p><b>Количество:</b> ' . $totalQty . '</p>',
    '<p><b>Итого:</b> ' . $total . ' ₽</p>',
    '<hr>',
    '<p>IP: ' . $escapeHtml($_SERVER['REMOTE_ADDR'] ?? '') . '</p>',
    '<p>User-Agent: ' . $escapeHtml($_SERVER['HTTP_USER_AGENT'] ?? '') . '</p>',
    '</body>',
    '</html>',
]);

$encodedSubject = '=?UTF-8?B?' . base64_encode($subject) . '?=';
$headers = [
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    'From: locker39.ru <noreply@locker39.ru>',
    'Reply-To: locker39.ru <noreply@locker39.ru>',
];

if (!mail(BOOKING_MAIL_TO, $encodedSubject, $body, implode("\r\n", $headers))) {
    jsonResponse(['success' => false, 'message' => 'Не удалось отправить заявку. Попробуйте позже.'], 500);
}

jsonResponse(['success' => true, 'message' => 'Заявка отправлена.']);

