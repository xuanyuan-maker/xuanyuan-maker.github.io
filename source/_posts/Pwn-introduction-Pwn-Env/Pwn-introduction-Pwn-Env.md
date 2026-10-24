---
title: Pwn入门之二：配置Pwn环境
tags:
  - pwn
  - 入门
  - 环境配置
categories:
  - - pwn
    - Linux用户态
    - 基础知识
date: 2025-08-08 11:03:15
updated: 2026-10-24 18:34:56
---

# PWN入门之二：配置PWN环境

> 文章参考：[CTFWiki](https://ctf-wiki.org/pwn/linux/user-mode/environment/)

## 0x00 前言

现在的CTF-PWN以Linux下的用户态Pwn为主，更准确的说，是以Ubuntu这个Linux发行版的环境为主。因此，为了方便调试程序，我们需要不同版本的Ubuntu，因为有些漏洞只有再特定版本下才能触发，但是为每一个Ubuntu版本都配置一个拥有Pwn环境的虚拟机确实是不太现实，是安装虚拟机和配置环境非常消耗时间，而且每个虚拟机最少需要20GB的储存空间，最少2GB内存，如果这样操作，在我们打比赛的时候，最少也需要开3个虚拟机，两个版本的Ubuntu，一个kali（因为正经比赛不可能只做一个方向的题），再加上物理机上的windows系统，除非你的电脑是神机，否则可定吃不消，所以这里推荐只需要装一个kali虚拟机，在kali中安装pwn环境。

传统 CTF-Pwn 题目通常仅需要以下工具便能完成解题：

* IDA：对题目进行逆向分析
* Python + pwntools：用于编写漏洞利用脚本。
* gdb + pwndbg/peda：用于调试题目二进制文件。

需要注意的是，在初学阶段我们并不推荐任何基于 pwntools 进行过度二次包装的软件包，也不推荐你在利用脚本中使用 lambda 语句进行过度简化，我们更推荐你在学习到一定程度后再去根据个人使用习惯进行决定。

下面，我们从物理机上的配置出发，一步一步，手把手教你配置Pwn环境。

## 0x01 IDA的安装

![](Pwn-introduction-Pwn-Env/IDA_icon.jpg)

*噫！礼赞逆位之女神，为吾等撕开混沌之帷幕，令凡胎得窥深渊底层不可名状之真理。*

IDA的安装和其他Windows上的软件安装并没有什么不同，但是这玩意是付费的，所以我们这里安装的是绿色学习版，如果你有下载和安装学习版游戏的经验，这一步非常简单。

> 下载链接
>
> [吾爱破解论坛](https://www.52pojie.cn/thread-1874203-1-1.html)

关于IDA的基础使用方法，详见[此处应该补充一条链接，如果没有补充，请联系我](https://www.xuanyuan-blog.top/)

## 0x02 VM虚拟机的安装

M之前是需要付费的，不过被博通收购之后就成免费的了，不过有一点不好就是虚拟机的vmtools需要手动安装，不过这点我们不需要考虑，Kali Linux 自2019.3版本起，在安装过程中如果检测到运行在VMware虚拟机中，会自动安装open-vm-tools及open-vm-tools-desktop软件包以替代VMware Tools增强虚拟机功能。

> 下载链接
>
> [百度网盘](https://pan.baidu.com/s/1PA83JVj-C0GnGahDM5kbIA)提取码NBAL

![](Pwn-introduction-Pwn-Env/2-1.webp)

下载好后解压，如果你不会7z格式压缩文件的解压的话，请自行必应。

![](Pwn-introduction-Pwn-Env/2-2.webp)

**详细的安装方法请见[VMware17超详细安装方法](https://www.cnblogs.com/devjourney2025/articles/18949919)**

## 0x03 Kali Linux的安装

这将是你们学习网安的第一道坎，如果你不会解压的话另当别论，安装虚拟机比较耗费时间，所以建议你专门找出一段空闲的时间来干这个。

### 详细安装步骤

#### 1、下载kali镜像

> 下载链接：[kali.org](https://www.kali.org/)

进去之后就会有一个大大的**`DOWNLOAD`**摆在你眼前，点击它，来到选择镜像的页面。

我们选择这个选项

![](Pwn-introduction-Pwn-Env/3-1.webp)

一共有两种下载方式，选择适合自己的方式，推荐**`BT种子下载（磁力下载）`**

![](Pwn-introduction-Pwn-Env/3-2.webp)

下载好后是一个.iso文件

#### 2、在虚拟机上安装kali Linux

打开我们的VMware

点击创建虚拟机

![](Pwn-introduction-Pwn-Env/3-3.webp)

点击自定义，然后点击下一步

![](Pwn-introduction-Pwn-Env/3-4.webp)

硬件兼容性选择`Workstation 17.5 or later`，然后点击下一步

![](Pwn-introduction-Pwn-Env/3-5.webp)选择稍后安装操作系统

![](Pwn-introduction-Pwn-Env/3-6.webp)

客户机系统选择**`Linux`**，版本选择**`Debian 12.x 64位`**
![](Pwn-introduction-Pwn-Env/3-7.webp)

虚拟机名称随便起，位置最好选择D盘（如果你有）

![](Pwn-introduction-Pwn-Env/3-8.webp)

处理器配置如下

![](Pwn-introduction-Pwn-Env/3-9.webp)

内存分配8GB

![](Pwn-introduction-Pwn-Env/3-10.webp)

网络连接方式选择NAT

![](Pwn-introduction-Pwn-Env/3-11.webp)

I/O控制器类型选择**`LSI Logic`**

![](Pwn-introduction-Pwn-Env/3-12.webp)

虚拟磁盘类型选择**`SCSI`**

![](Pwn-introduction-Pwn-Env/3-14.webp)

最大磁盘大小最好50GB以上

![](Pwn-introduction-Pwn-Env/3-15.webp)

直接下一步
![](Pwn-introduction-Pwn-Env/3-16.webp)

然后点击完成，这样虚拟机的壳子我们就搭建好来，下面来安装系统。

在虚拟机的侧边栏可以看到虚拟机的配置，我们双击**`CD/DVD`**，之后选择`使用ISO映像文件`，选择刚刚下载的.iso文件

![](Pwn-introduction-Pwn-Env/3-17.webp)

然后开启此虚拟机

选择第一个安装方式，按回车
![](Pwn-introduction-Pwn-Env/3-18.webp)

在选择语言界面，选择English，因为英语环境下kali的安装成功率高，中文环境很容易报错

![](Pwn-introduction-Pwn-Env/3-19.webp)

后面的选项不用管，直接continu两步，完成语言选择，进入一个加载页面，等待加载完成

设置主机名，注意，主机名不等于用户名，这里相当于给虚拟机起个名字

设置域名，改成空，就是里面不写任何东西

![](Pwn-introduction-Pwn-Env/3-20.webp)

输入的全名，也就是真名（woc，盒），用于标识用户，不过咱也就是学学网安，打打比赛，这里填用户名就行了

![](Pwn-introduction-Pwn-Env/3-21.webp)

输入用户名

![](Pwn-introduction-Pwn-Env/3-22.webp)

输入密码，简单一点，方便使用

![](Pwn-introduction-Pwn-Env/3-23.webp)

使用区域和时间

![](Pwn-introduction-Pwn-Env/3-24.webp)

格式化磁盘，选择使用整个磁盘

![](Pwn-introduction-Pwn-Env/3-25.webp)

![](Pwn-introduction-Pwn-Env/3-26.webp)

![](Pwn-introduction-Pwn-Env/3-27.webp)

![](Pwn-introduction-Pwn-Env/3-28.webp)

选择Yes

![](Pwn-introduction-Pwn-Env/3-29.webp)

然后是一段短暂的安装。这里默认就好

![](Pwn-introduction-Pwn-Env/3-30.webp)

然后就是一段漫长的安装，耐心等待。

这里选择yes

![](Pwn-introduction-Pwn-Env/3-31.webp)

这里选择`/dev/sda`

![](Pwn-introduction-Pwn-Env/3-32.webp)选择continue重启虚拟机

![](Pwn-introduction-Pwn-Env/3-33.webp)

这样我们的虚拟机就安装好了，搞完这些，你可以去喝杯水，休息一下，因为后面还有很长一段路要走。

## 0x04 配置Kali Linux

刚安装好的kali看起来非常不友善，所以我们需要进一步配置，让它变得好用一点。

### 1、设置kali终端字体

快捷键`CTRL+ALT+T`打开终端（记住这个快捷键，很常用）。可以看到，字体非常小，所以我们来让它变大一点。

在右上角，找到`File`选项卡，找到里面的`Preferences`选项，中文名叫“首选项”，这个名称在很多软件中是通用的，举一反三。

![](Pwn-introduction-Pwn-Env/4-1.webp)

然后`Font`那一栏找到`Change`，然后将`Size`改成18，`Font`用来改字体，你也可以改成自己喜欢的字体

![](Pwn-introduction-Pwn-Env/4-2.webp)

改完之后就好看多了。

### 2、换源和更新系统

这是国内所有Linux发行版安装后的必备操作了，因为大部分Linux发行版的软件源都位于国外，所以访问时间较长，速度减慢（尤其校园网），所以我们就需要把软件源换成国内的，这样在更新系统和后续安装软件的过程中，速度会更快。

1. 先来给root用户换个密码，因为后面很多安装操作基于root权限操作，我觉得老是需要打一个`sudo`很麻烦，不如直接`su`到root用户安装的爽。
   输入如下命令切换到root用户，密码就是你的密码。

   > 注意：这是在终端中操作，终端中的粘贴快捷键是`CTRL`+`SHIFT`+`V`，复制同理。
   >
   > 注意：密码不会回显，并不是虚拟机没有读取输入 ，也不是你的键盘有问题。

   ```shell
   sudo su
   ```

   看到命令提示符从`$`变成`#`就是成功了

   然后再输入下面的命令，回车

   ```shell
   passwd
   ```

   > 注意！，和上面一样，读取密码的时候是不会有回显的。

   一般改成`toor`就行了，好记。有`passwd: password updated successfully`这样的提示就是改好了。

   然后输入`exit`退出`root`用户，在普通用户下输入如下指令，在输入你设置的root密码，看看有没有能不能登录上，要是不行，就重复上面的步骤，重新设置一下。

   ```shell
   su
   ```

2. 上一步验证完不要着急退出，在`root`用户下，先确认一下自己这套 Kali 用的是哪种源文件。

   Kali 从 **2026.2** 起把官方源挪到了新位置、换成了新格式：`/etc/apt/sources.list.d/kali.sources`（deb822 风格）。也就是说，2026.2 及之后装出来的系统，`/etc/apt/sources.list` 这个文件根本不存在——直接 `vim` 它只会新建一个空文件，而官方源还老老实实在 `kali.sources` 里生效，等于白换一场。

   先看一眼自己是哪种：

   ```shell
   ls -l /etc/apt/sources.list /etc/apt/sources.list.d/kali.sources
   ```

   看到 `kali.sources` 就是新格式，照着下面做；如果只有 `sources.list`，那是老格式，先把它转过来再改：

   ```shell
   apt update
   apt modernize-sources
   ```

   转换完文件还是同一个位置（`kali.sources`），接着往下走。

3. 备份并修改源文件

   ```shell
   cp /etc/apt/sources.list.d/kali.sources /etc/apt/sources.list.d/kali.sources.bak
   ```

   然后打开它：

   ```shell
   vim /etc/apt/sources.list.d/kali.sources
   ```

   在 vim 里按 `ggdG` 把内容全删掉，再把下面这段粘进去（还是`CTRL`+`SHIFT`+`V`）

   ```shell
   # 中科大Kali镜像源
   Types: deb
   URIs: https://mirrors.ustc.edu.cn/kali
   Suites: kali-rolling
   Components: main contrib non-free non-free-firmware
   Signed-By: /usr/share/keyrings/kali-archive-keyring.gpg
   ```

   几个字段顺手记一下，以后不用来回查：

   - `Types`：`deb` 是二进制包，够用了。`deb-src` 是源码包，只有你要自己编译或者调试某个包时才加，平时开着每次 update 都会多拉几十 MB，纯属拖慢自己。
   - `URIs`：镜像地址。想换阿里云就写`https://mirrors.aliyun.com/kali`，清华是`https://mirrors.tuna.tsinghua.edu.cn/kali`。**只写一个**，别把两三个镜像并列写上去，Kali 的仓库没有 by-hash 机制，两个镜像同步进度对不上时会互相打架，报“文件尺寸不符”之类的错。用 `https` 的前提是系统里有`ca-certificates`（正常装完的 Kali 都自带），要是更新时报 `SSL certificate ... verify failed`，那就先 `apt install ca-certificates`，或者把地址临时换成 `http://`。
   - `Suites`：分支，`kali-rolling` 就是默认的滚动版。
   - `Components`：组件，照抄即可，顺序无关。
   - `Signed-By`：校验镜像签名用的 keyring，Kali 自带，别删。

   然后输入，一定是输入`:`，不是按这个键，然后输入`wq`退出。

4. 换完源之后输入如下命令进行系统更新

   ```shell
   apt update && apt full-upgrade -y
   ```

   又是一段漫长的等待。

   然后清理缓存包

   ```shell
   apt clean && apt autoclean
   ```

### 3、更改系统语言和安装输入法

很多人倡议使用英文界面，但是对刚开始学习网安且过去12学习的都是应试英语的我们，英文界面还是不太友好，所以这里我们把kali的系统语言改为中文，减轻一点学习上的负担。

1. 切换到`root`用户，输入如下命令

   ```shell
   dpkg-reconfigure locales
   ```

   会进入到如下页面

   ![](Pwn-introduction-Pwn-Env/4-3.webp)

   上下键移动，移到最底部，找到`zh_CN.UTF-8`，空格选择，然后回车。

2. 下面来到这样的页面，依旧选择`zh_CN.UTF-8`然后回车

   ![](Pwn-introduction-Pwn-Env/4-4.webp)

3. 然后输入`reboot`重启

4. 重启之后可以看到我们的登陆界面就变成中文的了，登录之后，你会收到这样的提醒

   ![](Pwn-introduction-Pwn-Env/4-5.webp)

勾选“不要再次询问我”，并且**`保留旧的名称`**，不要用中文，用中文的话到时候使用命令行打文件路径的时候会很麻烦，这几个单词还是挺常见的，不用换。

5. 下面我们来安装中文输入法，平常也用不着，安装它也就是给脚本写写注释。
   输入下面的命令安装fcitx5输入法

   ```shell
   apt install fcitx5 fcitx5-pinyin
   ```

   安装完`reboot`重启一下。

6. 重启完点开左上角的开始菜单，搜索fcitx5，找到`fcitx5配置`，可以看到里面有拼音的选项

![](Pwn-introduction-Pwn-Env/4-6.webp)

1. 然后我们打开全局配置，可以看到它的快捷键。

## 0x05 配置pwn环境（kali）

我在文章中写了两个版本，一个是常规的一步一步安装，另一个就是使用docker一键部署的版本。虽然写了两个，但是，**docker那个版本非常难用**，我依旧保留它的原因是我认为这个方法可能会对某些人有用。如果你是一名刚刚入门的新手，千万不要选择docker，它的配置会让你抓狂。

### 1、安装pwntools

如果你之前有使用python的经验，你可能会习惯性的使用`pip`，但是这在kali里面是禁止的，他会给你跳一个警告：

```bash
error: externally-managed-environment

× This environment is externally managed
╰─> To install Python packages system-wide, try apt install
    python3-xyz, where xyz is the package you are trying to
    install.

    If you wish to install a non-Kali-packaged Python package,
    create a virtual environment using python3 -m venv path/to/venv.
    Then use path/to/venv/bin/python and path/to/venv/bin/pip. Make
    sure you have pypy3-venv installed.

    If you wish to install a non-Kali-packaged Python application,
    it may be easiest to use pipx install xyz, which will manage a
    virtual environment for you. Make sure you have pipx installed.

    For more information, refer to the following:
    * https://www.kali.org/docs/general-use/python3-external-packages/
    * /usr/share/doc/python3.13/README.venv

note: If you believe this is a mistake, please contact your Python installation or OS distribution provider. You can override this, at the risk of breaking your Python installation or OS, by passing --break-system-packages.
hint: See PEP 668 for the detailed specification.
```

但是没事，它的意思只是告诉你去使用官方提供的python包。

使用如下命令安装：

```bash
sudo apt install python3-pwntools
```

验证安装：

```bash
python
```

然后输入如下内容回车，若没有任何报错或者输出，则安装成功

```python
import pwn
```

![](Pwn-introduction-Pwn-Env/5-1.webp)

### 2、安装one_gadget && seccomp-tools

```bash
gem install one_gadget seccomp-tools
```

```bash
echo 'export PATH="$HOME/.local/share/gem/ruby/3.3.0/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

### 3、安装pwndbg（非常重要！！！）

这一步建议使用科学上网，虽然最近国内放开了对github的访问限制，但是访问还是不太稳定，建议使用科学上网。

使用这条命令创建一个专门存放工具的文件夹,然后切换到这文件夹。

```bash
cd && mkdir ctftools 
```

```bash
cd ctftools
```

然后克隆这个`pwndbg`这个项目。

```bash
git clone https://github.com/pwndbg/pwndbg.git
```

切换到`pwndbg`目录下

```bash
cd pwndbg
```

运行安装脚本

```bash
./setup.sh
```

等待其安装完成后，如果下的太慢可以`ctrl+c`打断，然后重新执行上面的命令。

验证安装

```bash
gdb
```

出现以下画面就证明安装完成。

![](Pwn-introduction-Pwn-Env/5-2.webp)

> 这里非常不建议安装peda这个插件，手下是应为pwndbg这个插件功能非常健全，其次就是peda已经许多年不维护了。

### 4、安装main_arena_offset

首先切换到`root`用户

执行下面的命令

```bash
sudo git clone https://github.com/bash-c/main_arena_offset.git /tmp/main_arena_offset_src && \
    mv /tmp/main_arena_offset_src/main_arena /usr/local/bin/main_arena_offset && \
    chmod +x /usr/local/bin/main_arena_offset && \
    rm -rf /tmp/main_arena_offset_src
```

### 5、安装patchelf和glibc_all_in_one

patchelf是用来更换ELF文件的依赖的，因为有些题目中的漏洞只能在特定版本的libc下才能触发。glibc_all_in_one则是用来下载不同版本libc的工具。

确保你在普通用户而不在`root`用户

```bash
sudo apt install -y patchelf
```

```bash
cd ~/ctftools/
```

```bash
git clone https://github.com/matrix1001/glibc-all-in-one.git
```
