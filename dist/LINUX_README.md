## Breach README

Breach currently requires some coaxing to run under most linux
distributions. There are two known issues that you may run into --
both occur immediately after running breach like so:

```
./breach
```

Solutions to the issues are outlined below.

### `libudev.so.0` problem

`libudev0` has been removed from many recent distributions, which
stops Breach from running out of the box. One fix is to make a
symbolic link pointing to your libudev.so.1 file:

```
sudo ln -sf /lib/$(arch)-linux-gnu/libudev.so.1 /lib/$(arch)-linux-gnu/libudev.so.0
```

A more dangerous fix is to replace the reference to libudev.so.0 in the
exo_browser executable with a reference to libudev.so.1. You can
do that with the following sed command (it's safest to back up the file first):

```
sed -i 's/udev\.so\.0/udev.so.1/g' __AUTO_UPDATE_BUNDLE__/exo_browser/exo_browser
```

If you need more information, see these [solutions for missing libudev.so.0](https://github.com/rogerwang/node-webkit/wiki/The-solution-of-lacking-libudev.so.0).

### SUID Sandbox problem

Breach is based on the Chromium content module which requires a
SUID sandbox process to chroot the renderer processes on linux.
Running Breach out of the box on linux will probably result in
the following error:

```
[4590:4590:0721/143932:27331338145:FATAL:browser_main_loop.cc(172)]
Running without the SUID sandbox!
See https://code.google.com/p/chromium/wiki/LinuxSUIDSandboxDevelopment
for more information on developing with the sandbox on.
Aborted (core dumped)
```

To properly handle the access to the sandbox, you need to either
point Breach to an existing `chrome-sandbox`, or install one and
point there.

**Pointing Breach to an existing `chrome-sandbox`** If you have
chrome installed, you can point Breach to the SUID sandbox
you've already got. The path could be a number of things, but
you probably want one of the two following environment variable
settings:
`export CHROME_DEVEL_SANDBOX=/opt/google/chrome/chrome-sandbox`, or
`export CHROME_DEVEL_SANDBOX=/usr/local/sbin/chrome-devel-sandbox`

**Build your own `chrome-devel-sandbox`** The instructions provided
in the [LinuxSUIDSandboxDevelopment](https://code.google.com/p/chromium/wiki/LinuxSUIDSandboxDevelopment)
chromium dev page will tell you how to build the sandbox, which you
can then point to. You will have to have the chromium source code
checked out and ready to build.
