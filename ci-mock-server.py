#!/usr/bin/env python3
"""CI 用的最小模拟后端。

为什么要它：
  GitHub 的 macOS runner 能跑 iOS 模拟器，但连不到我们内网的真后端。
  为了让聊天页在模拟器里走完整链路（换会话凭证 -> 发消息 -> 收回复），
  这里实现最小的一套接口，行为跟真后端一致。

只用于 CI 验证，不是生产代码。
"""
import json
import os
import random
import re
import string
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

# 静态文件根目录：优先用环境变量，否则用当前工作目录。
# CI 里会先 cd 到构建产物目录再启动这个脚本。
WEB = os.environ.get("WEB_ROOT") or os.getcwd()

SESSIONS = {}
CHANNEL = "chn_ci_test_channel"
TICKET_HINT = "看起来是封禁的问题。"


def rid(prefix, n=20):
    return prefix + "".join(random.choice(string.ascii_letters + string.digits) for _ in range(n))


class H(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *args):
        sys.stderr.write("  [mock] %s\n" % (fmt % args))

    def _send(self, code, body, ctype="application/json; charset=utf-8"):
        raw = body.encode("utf-8") if isinstance(body, str) else body
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
        self.end_headers()
        self.wfile.write(raw)

    def _json(self, code, obj):
        self._send(code, json.dumps(obj, ensure_ascii=False))

    def do_OPTIONS(self):
        self._send(204, b"")

    def _read_body(self):
        n = int(self.headers.get("Content-Length") or 0)
        if not n:
            return {}
        raw = self.rfile.read(n)
        # 兼容不同终端编码（CI 是 UTF-8，Windows 本地 shell 可能是 GBK）
        for enc in ("utf-8", "gbk", "latin-1"):
            try:
                return json.loads(raw.decode(enc))
            except (UnicodeDecodeError, json.JSONDecodeError):
                continue
        return {}

    def do_GET(self):
        path = self.path.split("?")[0]

        if path == "/v1/embed/sign":
            self._json(200, {
                "url": "/chat?app_id=app_ci&role_id=999001&ts=1&sign=ci",
                "ts": 1, "sign": "ci",
            })
            return
        if path == "/health":
            self._json(200, {"ok": True})
            return

        # 静态文件：/chat -> chat.html，/ -> index.html（和真后端的路由映射一致）
        if path in ("/", ""):
            rel = "index.html"
        else:
            rel = path.lstrip("/")
            fp = os.path.join(WEB, rel)
            if not os.path.isfile(fp) and "." not in os.path.basename(rel):
                rel = rel + ".html"
        fp = os.path.join(WEB, rel)
        if not os.path.isfile(fp):
            self._send(404, "not found", "text/plain; charset=utf-8")
            return
        ctype = "text/html; charset=utf-8"
        if fp.endswith(".js"):
            ctype = "application/javascript; charset=utf-8"
        elif fp.endswith(".css"):
            ctype = "text/css; charset=utf-8"
        elif fp.endswith(".json"):
            ctype = "application/json; charset=utf-8"
        with open(fp, "rb") as f:
            self._send(200, f.read(), ctype)

    def do_POST(self):
        path = self.path.split("?")[0]

        if path == "/v1/embed/session":
            body = self._read_body()
            if not body.get("app_id") or not body.get("role_id"):
                self._json(400, {"detail": "缺少参数"})
                return
            tok = rid("es_", 28)
            SESSIONS[tok] = body.get("role_id")
            self._json(200, {
                "session": tok,
                "tenant_id": "game_ci",
                "app_id": body.get("app_id"),
                "role_id": body.get("role_id"),
                "nickname": "",
                "channel_id": CHANNEL,
                "expires_in": 86400,
            })
            return

        if path.startswith("/v1/inbound/"):
            tok = self.headers.get("X-API-Key") or ""
            if tok not in SESSIONS:
                self._json(401, {"detail": "会话无效"})
                return
            body = self._read_body()
            content = ((body.get("payload") or {}).get("content") or "").strip()
            reply = ("%s 您的角色信息我已经收到了，不用再提供。"
                     "请问大概什么时候充的、充了多少、走的哪个渠道（苹果/微信/支付宝）？" % TICKET_HINT)
            if not content:
                reply = "请描述一下遇到的问题。"
            self._json(200, {
                "conversation_id": "cnv_ci_001",
                "turn_id": "trn_ci_001",
                "action": "clarify",
                "answer": reply,
                "handoff": False,
                "confidence": 0.82,
                "latency_ms": 120,
                "trace_ms": 130,
                "scoring": {},
                "render": {
                    "ret_code": 0,
                    "ret_message": reply,
                    "x_platform": {"action": "clarify", "handoff": False},
                },
            })
            return

        self._json(404, {"detail": "not found"})


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    srv = ThreadingHTTPServer(("127.0.0.1", port), H)
    print("mock server on http://127.0.0.1:%d  (web root: %s)" % (port, WEB), flush=True)
    srv.serve_forever()