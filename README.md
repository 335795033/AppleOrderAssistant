# 三丈apple助手（Chrome 扩展）

**Apple 官网 iPhone 自动抢购/捡漏助手**（Chrome / Edge，Manifest V3）。

苹果官网本身并未限制下单，但热门机型的配送/到店自提可能很快售罄。本扩展用于**自动捡漏**：当所选门店出现「可取货」库存、或所选配送时段可用时，自动帮你走完从门店/配送选择 → 收货信息 → 发票 → 付款方式的结账流程，直到付款确认页由你人工付款。

> **仅供个人学习与自用**，请勿用于任何商业或恶意用途。本项目为**私有仓库**，未授权不对外分发。

---

## 功能一览

- **两种抢购模式**
  - **我要取货（刷库存）**：自动在当前城市挑选「可取货」门店并进入下一步；所选区域无可取货门店时，自动循环切换省/市/区刷新门店列表，一旦出现可取货门店立即选中继续；全部区域无货则转入后台轮询盯守。
  - **为我送货（快递配送）**：进入结账后自动选择第一个可用的配送时段（避开会弹出「预定时间快递送货」弹窗的「今天送达」），随后自动填好收货地址、联系方式并继续选择付款方式；发票类型与抬头按配置自动选择。
- **自动填写**：收货人姓名/手机/邮箱/身份证、收货地址、发票等（在配置页一次填好）。
- **防风控**：遇 404 / 被踢出登录时自动清理 cookie 重建会话；频次过高时自动暂停，避免继续被风控。
- **抢到提醒**：语音播报（tts）+ 可选自定义 GET 推送接口（Bark / Server酱 等）。
- **激活码授权**：开启自动抢购前需验证带到期时间的激活码，到期前无需重复输入。

---

## 快速开始

### 1. 安装依赖
```bash
npm install
```

### 2. 配置激活码密钥
激活码签名 SECRET 位于 `app/shared/constants.ts`（`ACTIVATION_SECRET`），与离线生成器 `activation-generator.html` 保持一致。默认代码里的 SECRET 仅供本地测试——**正式使用请改成你自己的高强度随机串**，并重新用生成器生成激活码。

> 生成器为本地离线 HTML，不进浏览器也可直接双击打开使用；请妥善保管，勿外传。

### 3. 构建并打包
```bash
# 一条命令完成：清理 → webpack 编译注入脚本 → Next 静态页 → 收尾 → 压 zip
./build-extension.sh                 # 产物 SanZhangApple_vX.Y.zip
./build-extension.sh --no-zip        # 只构建，产物在 extension/ 目录可直接加载
```

构建本质为三步（脚本已封装）：
1. `webpack --config extension.webpack.config.js` —— 编译 content / inject 脚本到 `extension/`
2. `BUILD_TYPE=extension next build` —— 把 popup / options 配置页打成静态页到 `extension/dist/`
3. `node buildAfter.js` —— 资源路径收尾

### 4. 加载扩展
1. 浏览器地址栏进入 `chrome://extensions`（Edge 为 `edge://extensions`）
2. 右上角开启「开发者模式」
3. 点「加载已解压缩的扩展程序」，选择项目根目录下的 **`extension/`** 文件夹
4. 固定到工具栏，点图标 → 「配置」填好信息 → 回到弹窗点「确认」开启自动抢购

> 改代码后重跑 `./build-extension.sh --no-zip`，再到 `chrome://extensions` 点扩展上的「刷新」即可生效。

---

## 使用流程（重要）

1. 在**配置页**填好个人信息与省/市/区（自提选方便取货的城市；「为我送货」还需填详细地址与发票），点「保存」。
2. 用同一浏览器登录 apple.com.cn，到开抢时间后**自己手动把想抢的机型加入购物袋**（扩展不代抢「加入购物袋」这一步），并停留在购物袋页面。
3. 点工具栏扩展图标打开弹窗 → 点「确认」开启自动抢购（首次需输激活码）。
4. 扩展自动走完：选门店/送货 → 填地址 → 填发票 → 选付款方式，直到付款确认页由你**人工付款**。

**提醒**：全程保持电脑不休眠；建议用无痕窗口运行以降低被风控概率；`StepWait` 步频不要设太短，避免过快去重触发风控。

---

## 目录结构

```
app/
  (pages)/popup/page.tsx     弹窗
  (pages)/options/page.tsx   配置页
  scripts/content/           注入脚本（doPickup / doDelivery / doFroApplePages …）
  shared/                    constants / activation / util / interface 等共享模块
extension/                   构建产物（manifest + content-script + dist 页面 + icons）
extension.webpack.config.js  content script 打包配置
build-extension.sh           一键构建打包脚本
activation-generator.html    激活码离线生成器（勿外传）
```

## 更新日志

- v2.9 — 使用说明补充「手动加购」步骤；品牌更名为「三丈apple助手」；激活码算法升级 SHA-256 + 随机盐。
- v2.8 — 配置页新增可折叠「使用说明」。
- v2.7 — 激活码 SHA-256 + 随机盐升级；品牌名替换；图标更新。
- v2.0~v2.6 — 新增「为我送货」模式、激活码授权、UI 驱动选店等。
- v0.5~v1.9 — 基础自提捡漏流程。
