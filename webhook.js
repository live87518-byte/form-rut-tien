// webhook.js
const fetch = require('node-fetch');

// ⚠️ THAY THẾ LINK FIREBASE CỦA BẠN VÀO ĐÂY
const FIREBASE_URL = "Https://webo-7939c-default-rtdb.asia-southeast1.firebasedatabase.app/"; 
const BOT_TOKEN = "8664079130:AAGCDkMhNyjnfNM9wceQ_Pc301bIMYetvdA";

let pendingRejections = {}; 

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(200).send('Webhook server is online.');
    }

    const body = req.body;

    // 1. XỬ LÝ SỰ KIỆN CALLBACK KHI BẤM NÚT DUYỆT / TỪ CHỐI
    if (body.callback_query) {
        const query = body.callback_query;
        const data = query.data;
        const chatId = query.message.chat.id;
        const messageId = query.message.message_id;
        const originalText = query.message.text;

        // --- HÀNH ĐỘNG: DUYỆT ĐƠN ---
        if (data.startsWith('approve_')) {
            const txId = data.replace('approve_', '');

            try {
                // Bước A: Lấy thông tin chi tiết đơn hàng rút từ Firebase
                const txRes = await fetch(`${FIREBASE_URL}/transactions/${txId}.json`);
                const txData = await txRes.json();

                if (!txData) {
                    throw new Error("Giao dịch không tồn tại!");
                }

                if (txData.status !== "pending") {
                    return res.status(200).send('Đơn này đã xử lý rồi!');
                }

                const username = txData.username;
                const withdrawAmount = Number(txData.amount);

                // Bước B: Kiểm tra số dư người dùng
                const userRes = await fetch(`${FIREBASE_URL}/users/${username}.json`);
                const userData = await userRes.json();
                const currentBalance = Number(userData.balance);

                if (currentBalance < withdrawAmount) {
                    // Nếu số dư không đủ
                    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            chat_id: chatId,
                            text: `⚠️ *LỖI DUYỆT ĐƠN:* Tài khoản \`${username}\` không đủ số dư để thực hiện rút \`${withdrawAmount.toLocaleString('vi-VN')}đ\` (Số dư hiện tại: \`${currentBalance.toLocaleString('vi-VN')}đ\`).`,
                            parse_mode: 'Markdown'
                        })
                    });
                    
                    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ callback_query_id: query.id, text: "Thất bại! Số dư không đủ." })
                    });
                    return res.status(200).send('OK');
                }

                // Bước C: Trừ tiền người dùng và cập nhật trạng thái đơn hàng thành công
                const newBalance = currentBalance - withdrawAmount;

                await fetch(`${FIREBASE_URL}/users/${username}.json`, {
                    method: 'PATCH',
                    body: JSON.stringify({ balance: newBalance })
                });

                await fetch(`${FIREBASE_URL}/transactions/${txId}.json`, {
                    method: 'PATCH',
                    body: JSON.stringify({ status: "approved" })
                });

                // Cập nhật lại tin nhắn trong nhóm Telegram
                await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chat_id: chatId,
                        message_id: messageId,
                        text: originalText + `\n\n🟢 *TRẠNG THÁI:* ĐÃ DUYỆT ✅\n💸 *Số dư mới:* ${newBalance.toLocaleString('vi-VN')}đ`,
                        parse_mode: 'Markdown'
                    })
                });

                await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ callback_query_id: query.id, text: "Duyệt thành công! Đã khấu trừ số dư." })
                });

            } catch (err) {
                console.error(err);
            }
        }

        // --- HÀNH ĐỘNG: TỪ CHỐI ĐƠN ---
        if (data.startsWith('reject_')) {
            const txId = data.replace('reject_', '');

            pendingRejections[chatId] = { txId, messageId, originalText };

            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: `✍️ *Nhập lý do từ chối* cho mã đơn \`${txId}\`:`,
                    parse_mode: 'Markdown'
                })
            });

            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ callback_query_id: query.id })
            });
        }

        return res.status(200).send('OK');
    }

    // 2. ADMIN NHẬP LÝ DO TỪ CHỐI (KẾT THÚC TIẾN TRÌNH TỪ CHỐI)
    if (body.message && body.message.text) {
        const chatId = body.message.chat.id;
        const text = body.message.text;

        if (pendingRejections[chatId]) {
            const { txId, messageId, originalText } = pendingRejections[chatId];

            // Chuyển đơn sang trạng thái rejected và cập nhật lý do, KHÔNG trừ tiền của người dùng
            await fetch(`${FIREBASE_URL}/transactions/${txId}.json`, {
                method: 'PATCH',
                body: JSON.stringify({ status: "rejected", note: text })
            });

            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    message_id: messageId,
                    text: originalText + `\n\n🔴 *TRẠNG THÁI:* ĐÃ TỪ CHỐI ❌\n💬 *Lý do:* _${text}_`,
                    parse_mode: 'Markdown'
                })
            });

            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: `✅ Đơn \`${txId}\` đã được từ chối với lý do: _${text}_`,
                    parse_mode: 'Markdown'
                })
            });

            delete pendingRejections[chatId];
        }
    }

    return res.status(200).send('OK');
};
