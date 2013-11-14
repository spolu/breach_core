### Breach: A Browser for the Power-User

- **Free** Open-source, and Free
- **Usable** Innovative but only if it's easy to use and easy to learn
- **Hackable** Lets users easily change or extend the behaviour of their browser

### Module API
```
var breach = require('breach');

breach.emit(type, message);
breach.register(module, type, function(message) {});

breach.module(module).call(method, args, function(err, result) {});
breach.expose(method, function(args, cb_) {});

// `breach/core` API

breach.expose('create_control', function({ url }, cb_);
breach.expose('show_control', function({ control_id, disposition, dimension }, cb_);

breach.emit('state:change:page_id', { state });
breach.emit('state:new_page', { page_id, url });
breach.emit('state:destroy_page', { page_id });
breach.emit('state:show_page', { page_id });

// `breach/core` example

breach.module('breach/core').call('create_control', {
  url: 'http://localhost:123'
}, function(err, control_id) {
  breach.module('breach/core').call('show_control', {
    control_id: control_id,
    type: 'TOP',
    dimension: 200
  });
});

breach.register('breach/core', 'state:change', function(msg) {
  // ...
  breach.module('breach/core').call('state_activate_page', { page_id: '12ae' });
  breach.module('breach/core').call('page_reload', { page_id: '12ae' });
  breach.module('breach/core').call('page_load_url', { 
    page_id: '12ae',
    url: 'http://google.com'
  });
});
```

### Credits
Icon courtesy of (@helloseim)[http://twitter.com/helloseim] (http://cherryseim.com/)
http://dribbble.com/shots/1129764-Safari-iOS7-Icon-Remix
