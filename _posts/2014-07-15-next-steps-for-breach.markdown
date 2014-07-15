---
layout: post
title:  "9 Questions on the Future of Breach"
date:   2014-07-15 10:00:00
---

I received an email from Timur, representing [my-chrome.ru](http://my-chrome.ru), for an article there on Breach. He had a bunch of very interesting questions, so I figured I would write my answers here as pointers on the future of Breach after the alpha release last week!

> 1/ *When did you start to work on Breach? I found news from 09.2013 in blog. But when did you start to a) thinking about it; b) coding.*

Started working thinking about bundling a nodeJS thread within the Chromium event loop in June 2013 :) Then I got married and went on vacation and I started coding in August 2013 and published that original blog post in September (long time ago!): [The Experimentation platform to build a Next Generation Web Browser](http://breach.cc/2013/09/05/the-experimentation-platform-to-build-a-next-generation-web-browser.html)

> 2/ *In your team, as i read, 3 or 4 people. But who is writing most of code? Only you?*

Before 7/10 mostly one coder, myself, with occasional contributions from @n1t0 and @deian, help and direction from @guille and a lot of help with the design of the landing and UI of m od_strip from @alevizio (all accounts are GitHub accounts!)

Now we have more contributors getting involved with the project and at least a couple ones working on rather substantial projects within Breach! Yay!

> 3/ *Is it difficult to merge with new Chromium version? How long does it take to update your core, when there are changes in Content API?*

It's slightly painful but overall OK. Generally takes 3-4h depending on how the content module API moved. The work on site-isolation / OOPI will require much more work as describe below

> 4/ *Are you planning to push new versions every 6 weeks like Chromium or not?*

Yes we'll try to keep up as fast as we can.

> 5/ *I found [ExoBrowser Architecture](http://breach.cc/2013/09/05/the-experimentation-platform-to-build-a-next-generation-web-browser.html). Is it actual for Breach?*

Yes. Today Breach (JS) runs on top of the ExoBrowser. The ExoBrowser basically exposes the Content API in NodeJS through native bindings and also exposes a basic view hierarchy to build a Browser. Implementors can use `exo_browser`s (windows) and `exo_frame`s (webview) either stacked as tabs or used as controllers (TOP, LEFT, BOTTOM, RIGHT, FLOATING). This limits the possibilities as far as UI/UX is concerned but is good enough for an alpha :) Basically in Breach, the mod_strip is an `exo_frame` (a WebContents) used as a TOP controller. And the inspector is another one used as a BOTTOM controller (see [exo_browser.h](https://github.com/breach/exo_browser/blob/master/src/browser/exo_browser.h)).

The next challenge is to move to a plugin model where the API become a single HTML document, with support for a special `<exo_frame>` tag (and its JS api). But to do that properly we need to wait for the Chromium team to get OOPI ready! This will let us get rid entirely of the basic view hierarchy while supporting multi-process for each `<exo_frame>`s' SiteIsolation.

> 6/ *Whats about a version for Windows?*

We'll probably wait on the move to OOPI/`<exo_frame>` above and rely on Aura instead of GTK+ for the windows creation... and boom! Windows support for free. We could move to Aura before then, but I'm not 100% sure Aura would easily support the layout constraints we need for the current controls system (Basically implement [exo_frame.h](https://github.com/breach/exo_browser/blob/master/src/browser/exo_browser.h) using Aura instead of GTK+). If anybody want to take a stab at it, be my guest :)

> 7/ *What are the Main problems with Breach now?*

Moving to OOPI / `<exo_frame>` and expose the gazillion APIs that we are not exposing yet:

- Basic auth
- HTML5 Permission request (geolocation, media capture) and notifications (this one is tricky as it requires native code)
- URL Request header injection (support for Do Not Track) and proxying through nodeJS (support for TOR)
- CSS & JS injection in renderer + RPC API with injected script (duh?)
- Explore using libcontentmodule (used by GitHub's Atom)

This is the reason why it's just an alpha! :) These lie mainly at the ExoBrowser level... Once we get that done, we'll need to work a lot as well on the `breach_core` API, to make it even more customisable and find an answer to these 3 major challenges:

- If we use `<exo_frame>`/OOPI then modules will mostly inject JS into the main HTML document. We need to find ways to coordinate them. These could be conventions on how to behave as a module, supported by factory methods for tabs `<exo_frame>` and controller `<exo_frame>` etc...
- Modules are highly decoupled for now. As an example, if someone wants to create a `mod_bookmark` bookmark module today, she will have to somehow add a button in `mod_strip`. Or `mod_strip` does not have an API for that at the moment, and this is a great question whether `breach_core` should provide structures to support that integration among modules or not?
- Build new browsing experiences. Many of us have the intuition that the tabbing model could be evolved especially using history. This is how Breach can be successful. By finding new ways to navigate the web and provide an alternative to the well know tab model proposed by everyone else. Firefox got popular because it was basically the only way to have tabs on windows at some point. This is how you make a browser successful. period. As mentioned in different blog posts, we're also very interested by browser state (the whole state incl. cookies and LocalStorage) syncing across devices, esp. the ones that you don't own (which is something current browser constructor do not cover at all (only tabs, only your devices))

PLENTY OF WORK! :)

> 8/ *You said that main browser should have 3 features: web-content, tabs, omnibox. What you think about Search Suggestions, Safe Browsing, prerender and other features from Chromium?*

Modules!

> 9/ *Will you upstream some code to Chromium/Blink/V8?*

No plan at the moment as we are still a small team and we have plenty on our plate already. But if the opportunity presents itself down the road. Of course yes!
