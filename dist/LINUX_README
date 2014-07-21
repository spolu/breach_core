### Breach README

### SUID Sandbox problem

Breach is based on the Chromium content module which requires a SUID sandbox 
process to chroot the renderer processes on linux. Running Breach out of the box 
on linux will probably result in the following error:

```
[4590:4590:0721/143932:27331338145:FATAL:browser_main_loop.cc(172)] 
Running without the SUID sandbox! 
See https://code.google.com/p/chromium/wiki/LinuxSUIDSandboxDevelopment 
for more information on developing with the sandbox on.
Aborted (core dumped)
```

To properly handle the access to the sandbox you have the following solutions:

**Point Breach to an existing `chrome-sandbox** If you have chrome installed 
locally you can point Breach to the SUID sandbox locally installed. Depending 
on your install the path may change, but you should set the following 
environment variable:
```
export CHROME_DEVEL_SANDBOX=/usr/local/sbin/chrome-devel-sandbox
```

**Install the `chrome-devel-sandbox`** By following the instructions provided 
in the error: [LinuxSUIDSandboxDevelopment](https://code.google.com/p/chromium/wiki/LinuxSUIDSandboxDevelopment)


### `libudev.so.0` problem

`libudev0` has been removed from recent distributions and prevents from running 
Breach out of the box resulting in an error at startup.

A great tutorial has been put together for node-webkit that is perfectly 
applicable for Breach as well: [The solution of lacking libudev.so.0](https://github.com/rogerwang/node-webkit/wiki/The-solution-of-lacking-libudev.so.0)
