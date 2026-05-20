---
name: lark-cli-start
version: 1.0.0
description: 启动并配置飞书 (Lark) CLI 工具。当用户需要初始化飞书 CLI、登录飞书账号、配置飞书凭证或首次使用飞书相关功能时使用。引导用户完成授权，自动获取并保存凭证。
metadata:
  requires:
    bins: ["npm", "node"]
---

# 飞书 CLI 启动技能

帮助用户快速启动和配置飞书 (Lark) CLI 工具。

## 工具

### install_cli

安装飞书 Lark CLI 工具。

```json
{
  "type": "bash",
  "description": "Install @larksuite/cli globally via npm"
}
```

执行命令：`npm install -g @larksuite/cli`

**输出处理：**
- 安装成功 → 继续下一步
- 已安装/更新 → 提示已安装，继续下一步
- 安装失败 → 提示清理 npm 缓存后重试：`npm cache clean --force && npm install -g @larksuite/cli`

---

### login

启动飞书登录流程，获取授权链接。

```json
{
  "type": "bash",
  "description": "Start Lark CLI login flow"
}
```

执行命令：`lark login`

**预期输出：**
```
Please open the following URL in your browser to authorize:
https://open.feishu.cn/open-apis/authen/v1/index?redirect_uri=xxx&app_id=xxx

Waiting for authorization...
```

**处理流程：**
1. 提取授权链接
2. **必须**将链接发送给用户：
   ```
   请使用浏览器打开以下链接，使用您的个人飞书账号完成授权：

   https://open.feishu.cn/open-apis/authen/v1/index?redirect_uri=xxx&app_id=xxx

   ⚠️ 重要提示：
   - 请使用个人飞书账号登录授权
   - 无需提前准备 App ID 和 App Secret
   - 授权完成后，CLI 会自动获取并保存凭证
   - 授权完成后请告诉我，我将继续检查登录状态
   ```
3. 等待用户确认已完成授权

---

### verify_login

验证登录状态。

```json
{
  "type": "bash",
  "description": "Verify Lark CLI login status"
}
```

执行命令：`lark whoami`

**成功响应示例：**
```
Logged in as:
- App ID: cli_xxxxxxxxxxxxxxxx
- App Name: xxx
- Tenant: xxx
- User: xxx@xxx.com
```

**处理结果：**
- 成功 → 登录流程完成
- 失败 → 提示用户重新执行登录流程

---

## 完整启动流程

### 步骤一：安装 CLI

使用 `install_cli` 工具安装飞书 CLI。

---

### 步骤二：登录授权

使用 `login` 工具启动登录流程。

**关键：必须将授权链接发送给用户**，不能只是执行命令等待。

---

### 步骤三：等待用户确认

等待用户回复「已完成授权」或类似确认。

**如果用户遇到问题：**

| 问题 | 解决方案 |
|------|----------|
| 无法打开链接 | 检查网络连接或尝试更换浏览器 |
| 提示无权限 | 确认使用个人飞书账号，而非企业账号 |
| 授权页面空白 | 尝试清除浏览器缓存或使用手机飞书扫码 |

---

### 步骤四：验证登录

用户确认后，使用 `verify_login` 工具验证登录状态。

**成功后显示：**
```
✓ 飞书 CLI 启动成功！

登录信息：
- App ID: cli_xxxxxxxxxxxxxxxx
- 用户名: xxx@xxx.com
- 凭证已自动保存，下次使用无需重新授权

可用命令：
- lark whoami          查看登录状态
- lark init <name>     初始化新项目
- lark dev             启动开发服务器
- lark --help          查看所有命令
```

---

## 故障排除

### 安装失败

```bash
# 清理 npm 缓存后重试
npm cache clean --force
npm install -g @larksuite/cli
```

### 授权后登录失败

1. 确认授权时使用的是个人飞书账号
2. 检查网络连接
3. 重新执行登录流程

### 凭证过期

```bash
# 登出当前账号
lark logout

# 重新登录
lark login
```

---

## 说明

### 关于凭证存储

- 凭证由 `lark-cli` 自动管理，存储在用户目录下的配置文件中
- 通常位于 `~/.lark/` 或类似目录
- 无需手动编辑 `.env` 文件

### 关于个人飞书授权

- 个人飞书账号可以访问大部分 API 功能
- 部分企业级功能可能需要企业管理员授权
- 如需更高权限，请联系企业管理员创建应用并分配权限
