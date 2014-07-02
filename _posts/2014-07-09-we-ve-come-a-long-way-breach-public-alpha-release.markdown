---
layout: post
title:  "We've Come a Long Way: Breach Public Alpha Release"
date:   2014-07-09 10:00:00
---

Last time I took the time to write down a blog post here, Breach as a name did not exist, and the whole project was barely taking off the ground. Let me tell you, we've come a long way! Over the past six months Breach became more than just an idea or a prototype. It became real through the exceptional contributions of a couple enthusiastic developers and designers!

In particular, Guillermo Rauch ([@guille](http://github.com/guille)) who pushed for the powerful modular model, and introduced me to Alejandro Vizio ([@alevizio](http://github.com/alevizio)) who designed the beautiful landing page as well as the global appearance of `mod_layout` (helped by [@heyimjuani](http://github.com/heyimjuani) and [@abadfederico](http://github.com/abadfederico)).

![Breach Screenshot](http://i.imgur.com/oHslEHv.png)

Since that last blog post, we have designed and entirely coded the Breach API exposed to modules to realize the vision of a fully modular browser where all functionalities are provided by simple and isolated web apps. We merged at least 4 major releases of the Chromium Content API keeping Breach core engine up to date with HTML5 standards (and those are nasty!). We also obviously fixed a gizilion bugs, making Breach stable enough to use it as our main browser everyday. We've done all of it on our spare time. At night. Early in the morning. Motivated by the prospect of releasing it to you guys.

We've come a long way, but this is only the beginning.

Although it is still *very young*, we believe that Breach is ready for an initial public alpha release. Breach will empower its users to hack and modify its behaviour and come up with new interesting ways to browse the web.

As you'll see we've been trying a few fun features with `mod_layout` (the default module installed at onboarding):

- Tabs are FIFO
- Tabs sniff the color of the page (well to be honest, the favicon)
- Typing in the URL bar let's you search/filter them 

These experimental features provide a rather enjoyable browsing experience. But this is really up to you to like it or not. And we won't blame you if you don't, but contrary to other browsers out there, with Breach, you have the freedom to entirely modify its aspect and behaviour and more importantly extend it. So we really want you to go look at the code and modify it so that you can create your own perfect browsing experience or try the modules that other deveopers may come up with.

We have many exciting plans for the future of Breach (like adding the numerous features and API still missing (duh?!) as well as other much more ambitious ideas that have yet to be laid down on GitHub). But we want to put it in your hands first, because we believe that no matter how many great plans we might have for it, the only thing that really matters is what you're going to do with it.

You'll be defining the future of Breach by hacking. And we can't wait to see what you come up with.

*-stan ([@spolu](https://twitter.com/spolu))*

