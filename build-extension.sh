#!/usr/bin/env bash
# ============================================================
#  Adzapple助手  一键构建 + 打包脚本（Windows Git Bash / macOS / Linux）
#  用法：
#     ./build-extension.sh               # 完整构建并打包 extension/ 目录
#     ./build-extension.sh --no-clean     # 跳过 .next 清理（可选，加速）
#     ./build-extension.sh --no-zip       # 只构建，不压 zip
#  产物：
#     AdzApple_vX.Y.zip（自动读取 manifest.json 里的版本号）
# ============================================================
set -e
cd "$(dirname "$0")"

CLEAN=1
ZIP=1
for arg in "$@"; do
  case "$arg" in
    --no-clean) CLEAN=0 ;;
    --no-zip)   ZIP=0 ;;
  esac
done

echo "==> [1/4] 清理旧产物"
if [ "$CLEAN" = "1" ]; then
  rm -rf .next extension/dist
else
  echo "    跳过清理 (--no-clean)"
fi

echo "==> [2/4] webpack 编译 content/inject script"
node ./node_modules/webpack/bin/webpack.js --config extension.webpack.config.js

echo "==> [3/4] Next.js 打包 popup/options 静态页面"
BUILD_TYPE=extension ./node_modules/.bin/next build
node ./buildAfter.js

# 读取 manifest 版本号
VER=$(node -e "console.log(require('./extension/manifest.json').version)")
OUT="AdzApple_v${VER}.zip"

if [ "$ZIP" = "1" ]; then
  echo "==> [4/4] 压缩为 ${OUT}"
  # 用 python 逐文件归档（保留目录结构，不含顶层 extension/ 文件夹本身）
  python - "$OUT" <<'PY'
import sys, os, zipfile
out = sys.argv[1]
if os.path.exists(out):
    os.remove(out)
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
    for root, _, files in os.walk('extension'):
        for f in files:
            p = os.path.join(root, f)
            z.write(p, os.path.relpath(p, 'extension'))
print(f'    done: {out}  ({os.path.getsize(out):,} bytes, {len(z.namelist())} files)')
PY
else
  echo "==> 跳过 zip (--no-zip)，产物在 extension/ 目录可直接加载"
fi

echo "==> 打包完成"
