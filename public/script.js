async function generateCode() {
    const number = document.getElementById('number').value;
    const resultDiv = document.getElementById('result');

    if (!number) {
        resultDiv.innerHTML = '⚠️ يرجى إدخال رقم الهاتف';
        return;
    }

    resultDiv.innerHTML = '⏳ جاري توليد الرمز...';

    try {
        const response = await fetch('/pair', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ number })
        });

        const data = await response.json();
        if (data.code) {
            resultDiv.innerHTML = `✅ رمز الاقتران: <strong>${data.code}</strong>`;
        } else {
            resultDiv.innerHTML = `❌ خطأ: ${data.error}`;
        }
    } catch (err) {
        resultDiv.innerHTML = '❌ حدث خطأ أثناء الاتصال بالسيرفر';
    }
}
