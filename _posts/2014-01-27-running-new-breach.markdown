---
layout: post
title:  "Running the new Breach"
date:   2014-01-27 12:27:00
---

Breach is now based on a modular architecture. The core of breach has no UI to
interact with. The UI is delegated to modules that can be added and run to
provide basic functionalities such as navigation bar, tabbed browsing, etc... 
The first module being coded is `breach/mod_stack` to provide stack based 
navigation. Here are the insttructions to run it:

1. Download and Extract the ExoBrowser:
[Linux](https://s3-eu-west-1.amazonaws.com/exobrowser/v0.5.1700/exo_browser-v0.5.1700-linux-x64.tar.gz) -
[Mac](https://s3-eu-west-1.amazonaws.com/exobrowser/v0.5.1700/exo_browser-v0.5.1700-osx-ia32.zip)
2. Clone `breach/breach_core`
3. Install modules: `npm install`
4. Run Breach `modules list`

```
in breach_core/
Linux: ~/exo_browser-v0.5.1700-linux-x64/exo_browser 
       --raw . modules list
Mac: ~/exo_browser-v0.5.1700-mac-ia32/ExoBrowser.app/Contents/MacOS/exo_browser 
     --raw . modules list
```

5. Clone `breach/mod_stack`
6. Add local `mod_stack` to Breach

```
in breach_core/
Linux: ~/exo_browser-v0.5.1700-linux-x64/exo_browser 
       --raw . modules add local:~/mod_stack
Mac: ~/exo_browser-v0.5.1700-mac-ia32/ExoBrowser.app/Contents/MacOS/exo_browser 
     --raw . modules add local:~/mod_stack
```

7. Run Breach with the local `mod_stack`

```
in breach_core/
Linux: ~/exo_browser-v0.5.1700-linux-x64/exo_browser 
       --raw --expose-gc .
Mac: ~/exo_browser-v0.5.1700-mac-ia32/ExoBrowser.app/Contents/MacOS/exo_browser 
     --raw --expose-gc .
```

Hint: each module in Breach runs its own separate process. The UI pages are served
locally. So it's possible to connect to the UI with a different browser to
inspect its content.

*-stan ([@spolu](https://twitter.com/spolu))*
