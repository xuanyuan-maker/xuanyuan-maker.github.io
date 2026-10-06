---
title: 项目
date: 2026-01-08 18:41:16
description: '个人开源项目介绍'
cover: /images/banner-1.webp
banner:
  background: true
---

## autoi-mcp

**autoi-mcp** 是一个基于 Model Context Protocol (MCP) 的自动化安全审计扩展。 [GitHub](https://github.com/xuanyuan-maker/autoi-mcp)通过 MCP 服务调用底层脚本操控 IDA Pro Python 自动化接口，实现对 IoT 固件二进制程序的**批量静态分析、敏感函数挖掘、输入可控点追踪及潜在漏洞定位**。

### 核心思路

1. **自动搜索** — 搜索 `system` / `popen` / `strcpy` / `sprintf` / `strcat` / `memcpy` / `gets` 等危险函数的导入和交叉引用
2. **定位输入** — 定位输入源 Source，搜索 `cgi_param` / `getenv` / `fgets` / `fread` 等 CGI 输入源
3. **追踪 Source-to-Sink 路径** — 同一函数内同时调用了输入源和危险函数 = 高风险路径
4. **识别认证函数** — 函数名含 `auth` / `login` / `session` / `check` 的全部标记
5. **风险评分排名** — 有 `system` / `popen` 得 30 分，有 `strcpy` / `sprintf` 得 25 分，有高危路径再加 30 分

### MCP 工具

| 工具 | 说明 | 需要 IDA |
|------|------|----------|
| `scan_firmware` | 批量扫描固件目录下所有 ELF，风险评分 + 过滤 | 否 |
| `check_elf` | 单文件快速检查：安全缓解措施 + 危险符号 | 否 |

### 安装

在 Claude Code 的 `.mcp.json` 或 `~/.claude/claude_desktop_config.json` 中添加：

```json
{
  "mcpServers": {
    "autoi-mcp": {
      "command": "uvx",
      "args": ["autoi-mcp"]
    }
  }
}
```

也可以从 PyPI 安装：

```bash
pip install autoi-mcp
```

---

## pwn-scripts

**pwn-scripts** 是 CTF 二进制利用（pwn）方向的小工具集合， [GitHub](https://github.com/xuanyuan-maker/pwn-scripts)旨在简化 pwn 题目的环境搭建和利用流程。

### 工具清单

#### chLibc — 快速更换 ELF 的 glibc 版本

在 pwn 题目中经常需要切换目标程序的 libc 版本，`chLibc` 一行命令搞定：

```bash
chLibc ./pwn 2.23
```

依赖：`patchelf`、`glibc-all-in-one`

#### pwninit — 初始化 pwn 题目环境

自动检测二进制架构、运行 checksec、生成 exp.py 模板：

```bash
pwninit ./pwn
```

### 安装

```bash
bash install.sh
```

自动将 `bin/` 目录添加到 PATH。

### 目录结构

```
.
├── bin/           # 可执行脚本
├── src/
│   ├── python/    # Python 脚本源码
│   └── shell/     # Shell 脚本源码
├── templates/     # exp.py 模板
└── install.sh     # 安装脚本
```
