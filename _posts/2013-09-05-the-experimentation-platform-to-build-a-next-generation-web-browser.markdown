---
layout: post
title:  "The Experimentation Platform to Build a Next Generation Web Browser"
date:   2013-09-05 15:19:50
---

From a user perspective, most of what today's web-browsers are dates back to the introduction of the tabbed browsing in 1997 ([Wikipedia: Tab (GUI)](http://en.wikipedia.org/wiki/Tab_%28GUI%29)). At this time, we restarted our computers, the closest thing to a smartphone we had was the Apple Newton, and we were "online" only for a couple of minutes through dial-up connections. 

Despite these major contextual shifts, this legacy approach to web-browsing was never challenged. I believe it simply does not cut it anymore for today's Web where the browser is always on, always connected.

I set out to build a new Browser and more importantly a new Experimentation Platform to build a better Browser for today's Web.

- **Free** Open-source, and Free
- **Usable** Innovative but only if it's easy to use and easy to learn
- **Hackable** Lets users easily change or extend the behaviour of their browser

Before releasing a fully-fledged browser, my goal is to run a set of experiments to explore specific concepts I find particularly interesting: 

- *Experiment 1*: **Stacked Navigation**
- *Experiment 2*: **Synchronized Sessions**

Each experiments will be released as a specialized browser, whose feature set is focused on the related experiment. To make this possible, I realized early on that I needed a proper testbed to try out concepts, iterate and validate them easily. Using platform-specific UI frameworks and C++ code was probably not going to cut it. So I came up with the concept of the **Scriptable Browser**. I call it the *ExoBrowser*. 


### The Scriptable Browser

The ExoBrowser (not much to do with, but largely inspired by the [ExoKernel](http://en.wikipedia.org/wiki/Exokernel)) aims at embedding NodeJS on top of a web rendering engine. The main goal pursued is to move the vast majority of the Browser code from C++ to Javascript (leveraging in particular Javascript closures and syntax as well as NodeJS native capabilities such as Networking).

The basic motivation behind the ExoBrowser is the realization that, building a browser, we have at our disposal a Javascript Engine as well as an HTML Rendering engine. So why should we go through the trouble of building the browser itself using C++? Why not "bootstrap" it and built it out of its own available technologies? That's exactly what the ExoBrowser wants to enable.

```
[Chromium Architecture]
  
  (Platform)        #   (Browser Implementation)
+----------------+  #  +-----------------------+
|  Content API   +-----+     Chrome (C++)      |
+----+-----------+  #  +-----------------------+
     |              #     |       |        |
+----+---+  +----+  #  +-----+ +-----+ +-------+
| Webkit +--+ v8 |  #  | GTK | | Win | | Cocoa |
+--------+  +----+  #  +-----+ +-----+ +-------+

`vs.`

[ExoBrowser Architecture]

             (Platform)                  #   (Browser Implementation)
+----------------+ +------------------+  #  +-----------------------+
|  Content API   +-+ ExoBrowser (C++) |-----+  Web Views (HTML/JS)  |
+----+-----------+ +--------------+---+  #  +-----------------------+
     |                   (JS API) |      #             | (Net)      
+----+---+  +----+ +--------------|---+  #  +-----------------------+
| Webkit +--+ v8 +-+    NodeJS    +---+-----+   Local Server (JS)   |
+--------+  +----+ +------------------+  #  +-----------------------+
```

The ExoBrowser only relies on a minimal amount of C++ and native UI code. Additionally, everything is a WebView, actual pages as well as every UI control. To avoid having to deal with cross platform UI  implementation issues in Javascript, the ExoBrowser provides a simplified view hierarchy exposed through its Javascript API (see [exo_browser.h](https://github.com/spolu/exo/blob/master/exo_browser/browser/ui/exo_browser.h)). This model is meant to be improved but has already proven itself powerful enough for the 1st Experiment needs.

This means that UI controls are actual web pages (I even use AngularJS for most of them) communicating with a local nodeJS server through socket.IO. The NodeJS server has access in Javascript to the low-level ExoBrowser API (see [ExoBrowser JS API Specification](https://github.com/spolu/exo/blob/master/API.md)) to talk to the native platform and rendering engine. This stack is much easier to tinker with and I hope will serve as an invitation to advanced users to customize and enhance the behavior of their browsers. 

In its current version, the ExoBrowser does not directly exposes the rendering engine interfaces to nodeJS but the Chromium Content API (see [Chromium: Content API](http://www.chromium.org/developers/content-module/content-api)) which provides a solid multi-process architecture to build upon.

As I mentioned, the major benefit from this approach is that the resulting Browser is fully scriptable on top of the ExoBrowser API. Our Experiments being only some possible implementations. Our current implementation of the 1st Experiment helped us confirm that this approach tremendously reduced our development time. I do hope this will also empower developers interested in hacking their browser, and foster innovation in the browser space.

The source code of the first version of the ExoBrowser is available and already powers our 1st Experiment. It can be built from the sources ([Building the ExoBrowser](https://github.com/spolu/exo_browser/wiki/Building-the-ExoBrowser)). It will also be available as a binary as part of the first Experiment release (see [Exp.1: Stacked Navigation](https://github.com/spolu/exo/wiki/Exp.1:-Stacked-Navigation))

### Experiments

This is a non-exhaustive list of experiments that I'd like to build on top of the ExoBrowser. Please do not hesitate to get in touch if you're particularly interested by one.

#### Stacked Navigation

The Stacked Navigation is an attempt to solve the issues that arise when you open too many tabs. The Stacked Navigation is somewhere between today's tabs and browsing history. It is a vertical list of pages you interacted with, the most recent ones being at the top. 

See [Exp.1: Stacked Navigation](https://github.com/spolu/exo/wiki/Exp.1:-Stacked-Navigation)

#### Synchronized Sessions

A session is the ability to save and restore as well as have multiple independent instances of the entire state of the browser (navigation, history, cookies). Additionally I would like to explore the synchronization of these sessions (cookies included) across devices.

See [Exp.2: Synchronized Sessions](https://github.com/spolu/exo/wiki/Exp.2:-Synchronized-Sessions)

### Conclusion

I am very excited by the possibilities opened by the ExoBrowser. I have already used it quite extensively working on our first experiment and I am very pleased with how it helped us create a fully custom Browser from scratch and how easy it is to modify the behaviour of the resulting browser. I hope it will get some people excited as well, and play a role as enabler for them to customize or build entire new browsing experiences.

I want to hear from you, do not hesitate to get in touch!

#### Building from the Source Code

You can already build the current development version of the ExoBrowser. Please refer to [Building the ExoBrowser](https://github.com/spolu/exo_browser/wiki/Building-the-ExoBrowser).

#### Getting Involved

I am currently actively developing the ExoBrowser. I am looking for as much feedback as I can get, as well as developers interested in tinkering with the ExoBrowser concept. Please get in touch on our mailing list: [exobrowser-dev](https://groups.google.com/forum/#!forum/exobrowser-dev) or on IRC (Freenode, #exobrowser).

*-stan ([@spolu](https://twitter.com/spolu))*
