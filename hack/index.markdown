---
layout: hack
title:  "Hacking Breach"
date:   2014-07-09 10:00:00
---

- [Resources](/hack#resources)
- [Introduction](/hack#introduction)
- [How to inspect a module](/hack#how-to-inspect-a-module)
- [How to hack a module](/hack#how-to-hack-a-module)
- [Understanding Breach architecture](/hack#understanding-breach-architecture)
- [Building your own new tab page module](/hack#building-your-own-new-tab-page-module)
- [Community Modules](/hack#community-modules)


### Resources <a name="resources"></a>

- Mailing list: [breach-dev@googlegroups.com](https://groups.google.com/d/forum/breach-dev)
- IRC Channel: #breach on Freenode
- Breach Core [Wiki](https://github.com/breach/breach_core/wiki)
- [API Reference](https://github.com/breach/breach_core/wiki/API-Reference-v0.3)
- Modules availble or under developement: [List of Modules](https://github.com/breach/breach_core/wiki/List-of-modules)

### Introduction <a name="introduction"></a>

The initial motivation to create Breach was to create a browser whose state (tabs, cookies, extensions, etc...) would be completely untangled from the machine it runs on, so that users could project that state on any machine running Breach easily. The idea was to let users get control of any machine around them transparently by making it very easy for them to push their state onto these machines. Think of it as tab syncing as seen in Chrome, Firefox, Safari, on steroids and built to be used on machines you don't necessarily own (which is a strong limitation in existing systems).

Now how do build an entire new browser from scratch without it taking you the next 10 years of your life. Chromium on top of the [Content Module](http://www.chromium.org/developers/content-module) (their multi-process architecture on top of Blink) is already 2m loc of C++ with a good chunk of it being platform specific code. This is clearly untractable, even for a couple of developers working on an opensource side-project.

Looking for a solution to that major showstopper, we realized that a shortcut was possible. What if instead of building the browser with platform specific C++ code, we attempted to build it using solely its very own technology stack, namely a rendering engine (blink in the case of Chrome) and a Javascript Engine (v8 here). That's how we ended up embedding a NodeJS thread within the Content Module and exposed the Content Module API directly into NodeJS through v8 native bindings.

The result is an executable exposing a NodeJS REPL with a special API to control browser windows and frames directly from Javascript. Some people will note the resemblance with node-webkit. Well, the building blocks are very similar but the overall architecture is fundamentally different: here we expose the Content API into a NodeJS context to have the necessary semantics and security model to build a browser using only Javascript code. Node-webkit, on the contrary, exposes nodeJS API within the renderer of a trivial browser (one window, one webcontents view) to make it super easy to build native apps using Javascript code.

This platform we came up with to build Breach is called the [ExoBrowser](http://github.com/breach/exo_browser). Having it available, we then decided to take Breach in a different direction. Instead of building a specific browser, why not build an entirely modular one that would let its user leverage this architecture to easily add functionalities through simple Javascript modules. That's exactly what Breach is today, a modular browser that does not expose any internal functionalities but an API for developers to build modules that can be added, removed, and interchanged very easily. In other words, Breach multiplexes the ExoBrowser API for modules to expose new functionalities. 

Oh, and by the way, Breach core is only 8k loc of JS... Easier to maintain than 2m loc of C++ heh!

Finally, building Breach, we kept in mind our initial vision. As you explore the code, you'll realize that the state of the Browser is very well compartimented. Today we release Breach as a modular browser so that you can leverage it to create new interesting browsing experiences that better suits you than the one size fits all of mainstream browsers. Want to have a modal, keyboard-only controlled browser with no UI at all? Be my guest!

This page will provide you with pointers on how to get started with Breach and build your very first module. This project is still quite young, so a lot of documentation is missing, but we'll be more than happy to answer any question you might have on IRC or over email! Have fun!

### How to inspect a module <a name="how-to-inspect-a-module"></a>

Some modules may not have any visual controller displayed to the user. As an example [mod_stats](https://github.com/breach/mod_stats) does not expose any UI to the user and simply aggregates events it captures through the Breach core API to Google Analytics. On the contrary, [mod_strip](https://github.com/breach/mod_strip) (the module installed by default at onboarding) exposes a UI control to the user to let him navigate through its tabs. Such a control is a regular web view pointed to a local URL served by the module itself. As a results this UI is purely web based and therefore entirely inspectable from within Breach.

To do so you can right click on the control, and open the inspector as depicted in the short video below.

<iframe width="640" height="480" src="//www.youtube.com/embed/83Vg4IQGG7s?rel=0" frameborder="0" allowfullscreen></iframe>

As you can see in the video as well, you can also reload the control of a module entirely.

Now let's try something even funnier. As controls are simple web-apps exposed locally, it's perfectly possible to open a control from another Browser and interact with it from there!

<iframe width="640" height="480" src="//www.youtube.com/embed/FYBjOj61y1I?rel=0" frameborder="0" allowfullscreen></iframe>

### How to hack a module <a name="how-to-hack-a-module"></a>

As described in the design document [Breach modular architecture](https://github.com/breach/breach_core/wiki/Breach-modular-architecture) modules are addressable through a GitHub URL of the form `github:breach/mod_strip` or a local URL of the form `local:~/src/breach/mod_strip`. 

- The former one instructs Breach to fetch the module from GitHub and install its dependencies locally under the Breach data path (`~/.breach/modules` on `linux` and `~/Library/Application Support/breach/modules` on `darwin`). 
- The later instructs Breach to execute the local module pointed by the specified path directly. It is used to develop or modify an existing module more conveniently. 

To illustrate how to hack a module, we're going to modify the behaviour of a local copy of `mod_strip`.

First step is to clone the module code locally and install its dependencies:

```
~/src$ git clone git@github.com:breach/mod_strip.git
~/src$ cd mod_strip
~/src$ npm install
```
Once the dependencies are installed, you can open the module manager within Breach by navigating to the URL `breach://modules`.

![Breach Module Manager](http://i.imgur.com/foIjPJ3.png)

There you can remove the `mod_strip` module currently running by clicking on `remove`. You can then add the local copy of your module by entering the appropriate path in the "Install Modules" input box (`local:~/path/to/mod_strip`). You should see your tab strip disappear and reappear unchanged when running the local copy of the module.

#### Changing the behaviour of mod_strip

We're going to add some extra logic to the module, by intercepting a certain string of character submitted in the URL box and associating with it a special action.

To help you work on a module, you can access the logs of a module by clicking on the `out` link from the module manager:

![Module Log](http://i.imgur.com/yGtXLIH.png)

From this screen you have access to the file where the log of the module is dumped, you can directly see a `tail` of that file below. Finally you can also restart the module right from there (go ahead, feel free to restart it).

Now you can edit the file `mod_strip/lib/box.js`. More specifically, you can add in the function `socket_submit`, the following line:

{% highlight javascript %}
console.log('BOX: ' + JSON.stringify(data));
{% endhighlight %}

Once the file is saved, you can restart the module, open a new URL and check that you properly see the log in the module manager's module output.

At the very beginning of that function, you can as an example intercept the string `:q` and close the tab in that case:

{% highlight javascript %}
socket_submit = function(data) { 
  console.log('BOX: ' + JSON.stringify(data));
  if(data.input === ':q') {
    common._.tabs.action_close();
    return;
  }
  // ...
{% endhighlight %}

You can restart the module, create a new tab, and type `:q` in the URL bar. The tab should close. You can explore the implementation of the `common._.tabs` object in `mod_strip/lib/tabs.js`. Make sure to check the initialization of the module as well in `mod_strip/index.js`.

#### Changing the CSS style of mod_strip

Additionally, there is a hidden dark theme for mod_strip. You can edit the file `mod_strip/controls/strip/index.html` and change the CSS class from `light` to `dark` on line 19, as well as file `mod_strip/controls/box/index.html` on the same line. Once edited, you don't need to restart the module as it impacts only client side code. You can see the update by right-clicking the tab strip and requesting a Reload.

### Understanding Breach architecture <a name="understanding-breach-architecture"></a>

Breach is composed of `breach_core` the core Javascript implementation that runs on top of the [ExoBrowser](https://github.com/breach/exo_browser). The ExoBrowser embeds the Chromium Content Module and exposes its API directly in a NodeJS context through V8 native bindings. Breach running on top of the ExoBrowser is basically in charge of multiplexing that API (really the Chromium Content Module API) among an arbitrary number of pure javascript modules running in separate isolated processes.

Breach is designed to be entirely modular, meaning that Breach does not expose *any* functionality if no module is running (except for the module manager and the onboarding).

To better understand how Breach is structured, you can refer to the wiki page [Building Breach from Source](https://github.com/breach/breach_core/wiki/Building-Breach-from-Source). It will walk you through the different steps needed to build the entire Breach stack from sources.

### Building your own new tab page module <a name="building-your-own-new-tab-page-module"></a>

Please refer to the wiki page [Creating a new module](https://github.com/breach/breach_core/wiki/Creating-a-new-module) to set up the basic structure of your new module. We'll assume here that this new module is called `mod_newtab`.

Since the goal of the module is to expose a new tab page, it will have to be able to serve such a page locally. For that purpose, we add `express` to the dependencies of the module:

{% highlight javascript %}
{
  "name": "mod_newtab",
  "version": "0.1.0",
  "main": "./index.js",
  "dependencies": {
    "breach_module": "0.3.x",
    "async": "0.9.x",
    "express": "4.0.x",
    "body-parser": "1.0.x",
    "method-override": "1.0.x",
    "request": "2.36.x"
  }
}
{% endhighlight %}

Then we have to create an express app in `index.js`, synchronize its creation with the initialization of the module and expose some static content for our new tab:

{% highlight javascript %}
var express = require('express');
var http = require('http');
var async = require('async');
var breach = require('breach_module');

var bootstrap = function(http_srv) {
  breach.init(function(cb_) {
    breach.expose('init', function(src, args, cb_) {
      return cb_();
    });
  
    breach.expose('kill', function(args, cb_) {
      process.exit(0);
    });

    console.log('Exposed: `http://127.0.0.1:' + port + '/newtab`');
  });
};

(function setup() {
  var app = express();

  /* App Configuration */
  app.use('/', express.static(__dirname + '/controls'));
  app.use(require('body-parser')());
  app.use(require('method-override')())

  /* Listen locally only */
  var http_srv = http.createServer(app).listen(0, '127.0.0.1');

  http_srv.on('listening', function() {
    var port = http_srv.address().port;
    return bootstrap(port);
  });
})();

{% endhighlight %}

You can create an html file `mod_newtab/controls/newtab/index.html` containing a first implementation of your new tab:


{% highlight javascript %}
<html>
  <body style="background-color: black; color: white;">
    Foo Bar!
  </body>
</html?>
{% endhighlight %}

If your run the module as is, after executing `npm install`, the module will simply expose the page on a local URL once initialized. You can retrieve the URL in the log of the module and check that the page is indeed accessible.

Last step is to instruct to Breach to use this page instead of the default one as a new tab page. This is done through the `tabs_new_tab_url` procedure exposed by the core_module. We can replace our exposed `init` procedure by the following:

{% highlight javascript %}
    breach.expose('init', function(src, args, cb_) {
      breach.module('core').call('tabs_new_tab_url', { 
        url: 'http://127.0.0.1:' + port + '/newtab'
      }, function(err) {
        console.log('New tab page set! [' + err + ']');
      });
      return cb_();
    });
{% endhighlight %}

You can then restart the module and check that your new tab page has replaced the default one. Congrats! :)

The full source code for this dummy new tab module is available here: [mod_newtab](https://github.com/breach/mod_newtab). If you want to see a fully functional new tab module, check out [New Tab Clock Page](https://github.com/RobinMalfait/mod_newtab_clock).

### Community Modules <a name="community-modules"></a>

Here is a [list of modules](https://github.com/breach/breach_core/wiki/List-of-modules) made by the community. If you want to create your onwn module, make sure to add it to the list of _in progress_ modules so we don't have duplicates.

### Conclusion

We'll come back with more advanced tutorials soon (especially one to create your own tabbing system). In the meantime you can of course start exploring the code of [mod_strip](https://github.com/breach/mod_strip) and [mod_stats](https://github.com/breach/mod_stats) to get examples of how to implement full browser experience using Breach.
