#!/usr/bin/env bash
# 把 iOS 模拟器包传到 Appetize，直接给你一个可以在浏览器里点的上网址。
#
# 用法：
#   bash upload-to-appetize.sh <你的_APPETIZE_API_TOKEN>
#
# token 从哪拿：
#   1. https://appetize.io 注册（免费，每月 30 分钟）
#   2. 登录后进 https://appetize.io/organization/api-tokens
#   3. 点 Generate API Token，Role 选 Admin，复制
set -e

TOKEN="${1:-}"
ZIP="${2:-$(dirname "$0")/../cs-app-simulator.zip}"

if [ -z "$TOKEN" ]; then
  echo "用法: bash upload-to-appetize.sh <API_TOKEN> [zip路径]"
  echo ""
  echo "token 获取: https://appetize.io/organization/api-tokens"
  exit 1
fi

if [ ! -f "$ZIP" ]; then
  echo "找不到包: $ZIP"
  echo "先下载: https://github.com/coderxzz/cs-platform-mobile/releases"
  exit 1
fi

echo "上传中: $ZIP ($(wc -c < "$ZIP") 字节)"
RESP=$(curl -s --max-time 300 -X POST \
  -H "X-API-KEY: $TOKEN" \
  -F "file=@$ZIP" \
  -F "platform=ios" \
  "https://api.appetize.io/v1/apps")

echo "$RESP"
echo
if echo "$RESP" | grep -q "publicKey"; then
  KEY=$(echo "$RESP" | sed -n 's/.*"publicKey":"\([^"]*\)".*/\1/p')
  echo "=========================================="
  echo "上传成功！"
  echo ""
  echo "在浏览器里打开这台 iPhone："
  echo "  https://appetize.io/app/$KEY"
  echo ""
  echo "带参数直接进聊天页（把 <ts>/<sign> 换成后端给的值）："
  echo "  https://appetize.io/app/$KEY?launchUrl=chat.html%3Fapp_id%3Dapp_aa5f6f3147144a1ca9f3%26role_id%3D999001%26ts%3D<ts>%26sign%3D<sign>"
  echo "=========================================="
else
  echo "上传失败，看上面的返回信息"
  exit 1
fi