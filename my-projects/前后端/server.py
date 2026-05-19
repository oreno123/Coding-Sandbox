"""
支付Demo后端 - Python Flask
运行方式: pip install flask && python server.py
访问地址: http://localhost:8000
"""

from flask import Flask, jsonify, request, send_from_directory
import uuid, time, threading, os

app = Flask(__name__, static_folder=".")

# ── 简易"数据库"（内存字典，生产环境换成 MySQL/Redis）──
orders = {}
# 结构: orders[order_id] = {
#   "id": "xxx",
#   "plan": "年付套餐",
#   "amount": 168,
#   "status": "pending",   # pending | paid | expired
#   "created_at": 1234567890
# }


# ══════════════════════════════════════════════
#  前端页面托管（直接访问 / 返回 index.html）
# ══════════════════════════════════════════════
@app.route("/")
def index():
    return send_from_directory(".", "index.html")


# ══════════════════════════════════════════════
#  API 1: 创建订单
#  前端点击"立即购买"时调用
#  返回: 订单ID + 二维码URL（真实项目里调支付宝/微信API）
# ══════════════════════════════════════════════
@app.route("/api/create-order", methods=["POST"])
def create_order():
    data = request.json
    plan = data.get("plan", "月付套餐")
    amount = data.get("amount", 28)

    order_id = "ORD-" + uuid.uuid4().hex[:8].upper()

    orders[order_id] = {
        "id": order_id,
        "plan": plan,
        "amount": amount,
        "status": "pending",
        "created_at": time.time()
    }

    print(f"[订单创建] {order_id} | {plan} | ¥{amount}")

    # 真实项目里，这里调用支付宝/微信SDK生成二维码URL
    # qr_url = alipay.api_alipay_trade_precreate(order_id, amount)
    # 这里用假URL模拟
    qr_url = f"https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=pay:{order_id}"

    # 模拟：10秒后自动变为"已支付"（代替真实扫码）
    def auto_pay():
        time.sleep(10)
        if order_id in orders and orders[order_id]["status"] == "pending":
            orders[order_id]["status"] = "paid"
            print(f"[支付成功] {order_id} ← 模拟支付平台回调")

    threading.Thread(target=auto_pay, daemon=True).start()

    return jsonify({
        "order_id": order_id,
        "qr_url": qr_url,
        "amount": amount,
        "plan": plan
    })


# ══════════════════════════════════════════════
#  API 2: 查询订单状态（前端每2秒轮询这个接口）
#  返回: status = pending / paid / expired
# ══════════════════════════════════════════════
@app.route("/api/order/status")
def order_status():
    order_id = request.args.get("id")

    if not order_id or order_id not in orders:
        return jsonify({"error": "订单不存在"}), 404

    order = orders[order_id]

    # 超过10分钟自动过期
    if time.time() - order["created_at"] > 600 and order["status"] == "pending":
        order["status"] = "expired"

    print(f"[轮询查询] {order_id} → status={order['status']}")

    return jsonify({
        "order_id": order_id,
        "status": order["status"],   # 前端关注这个字段
        "plan": order["plan"],
        "amount": order["amount"]
    })


# ══════════════════════════════════════════════
#  API 3: 支付平台异步回调（Webhook）
#  真实场景：支付宝/微信在用户付款后主动POST到这里
#  必须验签！否则任何人都能伪造支付成功
# ══════════════════════════════════════════════
@app.route("/api/pay-notify", methods=["POST"])
def pay_notify():
    data = request.json or request.form.to_dict()
    order_id = data.get("order_id") or data.get("out_trade_no")

    print(f"[支付回调] 收到通知: {data}")

    # ── 真实项目必须做签名验证 ──
    # if not verify_signature(data, secret_key):
    #     return "FAIL", 400

    if order_id and order_id in orders:
        orders[order_id]["status"] = "paid"
        print(f"[订单更新] {order_id} → paid")
        return jsonify({"code": "success"})  # 必须返回success，否则支付平台会反复重试

    return jsonify({"code": "fail", "msg": "订单不存在"}), 404


# ══════════════════════════════════════════════
#  API 4: 手动触发支付成功（仅用于本地演示）
# ══════════════════════════════════════════════
@app.route("/api/dev/pay-now", methods=["POST"])
def dev_pay_now():
    order_id = request.json.get("order_id")
    if order_id in orders:
        orders[order_id]["status"] = "paid"
        print(f"[DEV] 手动触发支付成功: {order_id}")
        return jsonify({"ok": True})
    return jsonify({"ok": False}), 404


if __name__ == "__main__":
    print("=" * 45)
    print("  支付Demo后端启动")
    print("  访问: http://localhost:8000")
    print("  支付回调: POST /api/pay-notify")
    print("=" * 45)
    app.run(host="0.0.0.0", port=8000, debug=True)
