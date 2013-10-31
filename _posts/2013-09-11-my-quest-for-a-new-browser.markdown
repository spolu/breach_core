---
layout: post
title:  "My Quest for a New Browser"
date:   2013-09-11 15:19:50
---

It's been almost a year since I started thinking about what a new browser could look like...

I think it all started because I was somehow unsatisfied by my overall online browsing experience. I had nothing precise to point out as particularly defective; after all a browser is a quite simple product: it has tabs, it renders pages, and Chrome's OmniBox is pretty awesome.

Yet, digging the problem, I realized that I ended up frustrated in a couple of specific situations related to what I could describe as an "overuse" of the browser.

I use the web a lot. My day is spent between my browser and xterm. I use xterm to code and I use the browser for absolutely everything else. Email, documents, bug tracking, news, games, videos, you name it.

However, the browser base user interface as we know it today (tabbed navigation) was designed at a time (97) when we restarted our computer everyday and we would spend only a couple of minutes "online" through dial-up connections.

### Why would we need a new Browser?

Today, our computers are always on, never restarted, always connected. As a result some of us end up with dozens of tabs opened; their email client webapp tab being lost in the middle of news articles and a bunch of API documentation pages. It just feels like something is missing. Is there anything more efficient? more adequate to how our use of the web has evolved over the years?

As an example, I feel like I spend way too much time curating my tabs everyday. It makes no sense for me that I can't easily search through the tabs I've closed. My intuition tells me that somehow the browsing history should be exposed more directly to the user and that opened tabs should become a much fuzzier concept; but that's just a guess.

Worse still (yet not as annoying), we use the web for almost anyting, all of our data is online (in the cloud, or some connected devices), and yet there is no good way for us to use any computer transparently. We're stuck with *our own* computer. Anytime I try to accomplish a task on a computer I don't own, I just feel like I want to kill myself out of frustration. My browsing state is lost, my preferences are lost, my credentials are lost, and I generally end up realizing that I forgot to update the phone number associated with my Google account's 2-step verification process.

As my data moves online, I expect to be able to grab any computer around me and use it as my own. There are a bunch of way to provide that, but I've grown convinced that it ought to be solved at the browser level.

I spent some time last year tinkering with a few side projects (a tiled window manager for vim, a terminal emulator implementation in JS, an AI combat game, ...). They were all a lot of fun, but I had the feeling that they were all sort of short-sighted. Additionally, since I'm a firm believer that you need to build something to properly assess if it's useful or not, I decided this summer that I would focus all my extra-professional coding efforts on this *grand* side-project: build a new experimental browser to test out these ideas. 

### Wanna build a Browser? So What's the Plan?

Where to start when you want to build a browser and there's so much you want to experiment with?

The `chrome/` subdirectory of the chromium project (all that makes up the Google Chrome experience: tabs, settings, sync, omnibox) is made up of 5,343 C++ implementation files, adding up to 1,449,451 lines of C++ code (as of 2013/09/11). It's hardly tractable by one person, and hints to the fact that it's probably impossible for one guy to modify it alone to come up with a profoundly different experience.

Even if you start directly from the Content API (Chromium internal API to display Web Contents), there's a good chance you'll have to write 10,000s lines of platform-specific code to come up with anything interesting.

I had to come up with a trick that would speed up the process of building a working browser, and more importantly, let me experiment faster (at least more rapidly than rewriting an entire UI in GTK+, or Cocoa, or both)

### The Solution

Web technologies (I mean HTML/JS/CSS here) have many drawbacks, but there's something we can't deny them, they're just great for rapid prototyping. Luckily, when you're working on a browser, it just happens that you have at your disposal a Layout Engine (Webkit/Blink) and a Javascript Engine (v8). So why not *bootstrap* the browser with these engines and build it out of its own available technologies instead of C++?

That is what I set myself out to do. The project was not going to be easy, but I knew that it was orders of magnitudes simpler than any other path I could follow. That's how I came up with the ExoBrowser.

### The ExoBrowser: Chromium Content API exposed in JS

The ExoBrowser consists in embedding an additional thread on top of the Chromium Content API to execute a v8 context in which some (eventually all) parts of the Chromium Content API is exposed.

Basically, this lets you control the creation and the lifecycle of WebContents (namely rendered web pages) directly from Javascript. 

Next thing you need, is a native container to display those WebContents and a cross-platform way to manipulate it. The ExoBrowser creates a simple platform-specific view hierarchy model in which you can display WebContents directly from Javascript. For now, I've kept this view model as simple as possible: I can display WebContents in a central area and add some "controls" (but these are just basic WebContents too) at the top, bottom, left and right of the main window (Think URL Box, Inspector, and eventually left & right "drawers").

From there, I just needed a way to serve web pages from my v8 context in order to point these "controls" WebContents to some local pages I could communicate with. That was what was needed for me to build my UI entirely in HTML.

Conveniently enough this technology is already available: it's exactly what Node.JS is. So instead of embedding a v8 Context, I simply embedded a Node.JS Context in my extra thread. I even got package & library management as well as  filesystem and netoworking APIs for free.

Here's a diagram of the ExoBrowser architecture compared to the Chromium architecture:

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

That's pretty much the state of the ExoBrowser right now. The ExoBrowser C++ implementation (with a lot of glue code) is only 5995 lines of C++. It's substantial but still totally tractable by a one person show.

Using the ExoBrowser, I was able to come up with a first experimental browser implementation. This first implementation focuses on a new "stacked Navigation" you can try out today. It is 3849 lines of Javascript with some HTML/CSS. It uses socket.io and AngularJS to render and communicate with the UI ("control" WebContents). 3k lines of code is definitely not *nothing*, but it is cross-platform (OSX, Linux for now) out of the box and requires probably at least an order of magnitude less code than what would have been required just to make something similar run on OSX only.

[For the experts: I won't enter in the specifics, but the ExoBrowser architecture is quite different from AppJS' and node-webkit's. Additionaly the API it exposes is much deeper so that I can build a working browser entirely out of JS]

### What's next?

I'm very pleased with the ExoBrowser and how it has let me build a browser using only Web Technologies and how I can rapidly test concepts and iterate.

Of course, I'm nowhere close to having a product (though I already use the Experiment based on the ExoBrowser for most of my activities online, such as writing this post). My quest is only beginning, and I definitely want to experiment with many more concepts (Additional navigation models, Synchronized Sessions, etc...)

The goal of this post is simply to let you know about my experience building it. Eventually, I also hope I can get you excited about building a new browser, or more precisly, about building new browsers.

**Thanks** to *Gabriel Hubert* for proof-reading this.

*-stan ([@spolu](https://twitter.com/spolu))*
