#!/usr/bin/env bash
# 一键推送：先建好仓库、加好 SSH 公钥，然后跑这个。
set -e
cd "$(dirname "$0")"
REPO_NAME="${1:-cs-platform-mobile}"
USER="xiezhuangzao"

echo "推送到 git@github.com:$USER/$REPO_NAME.git"
git remote remove origin 2>/dev/null || true
git remote add origin "git@github.com:$USER/$REPO_NAME.git"
git branch -M main

echo "测试 SSH 连接..."
ssh -i ~/.ssh/id_cs_platform -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new \
    -T git@github.com 2>&1 | head -2 || true

echo "推送..."
GIT_SSH_COMMAND="ssh -i ~/.ssh/id_cs_platform -o IdentitiesOnly=yes" \
  git push -u origin main

echo ""
echo "完成。查看 Actions："
echo "  https://github.com/$USER/$REPO_NAME/actions"
