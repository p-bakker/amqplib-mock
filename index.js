"use strict";
var Bluebird = require('bluebird');
var exchanges = {};
var queues = {};
var channel = {
  assertQueue: function (queue, qOptions) {
    return new Bluebird(function (resolve) {
      setIfUndef(queues, queue, { messages: [], subscribers: [], options: qOptions });
      return resolve({queue: queue});
    });
  },

  checkQueue: function (queue) {
    return new Bluebird(function (resolve, reject) {
      if (!queues[queue])
        return reject("Checking non-existing queue " + queue);
      return resolve();
    })
  },

  assertExchange: function (exchange, type, exchOptions) {
    return new Bluebird(function (resolve) {
      exchOptions = exchOptions || {};
      setIfUndef(exchanges, exchange, { bindings: [], options: exchOptions, type: type });

      return resolve({exchange: exchange});
    });
  },

  checkExchange: function (exchange) {
    return new Bluebird(function (resolve, reject) {
      if (!exchanges[exchange])
        return reject("Checking non-existing exchange " + exchange);
      return resolve();
    })
  },

  bindQueue: function (queue, exchange, key, args) {
    return new Bluebird(function (resolve, reject) {
      if (!exchanges[exchange])
        return reject("Bind to non-existing exchange " + exchange);

      var re = "^" + key.replace(".", "\\.").replace("#", "(\\w|\\.)+").replace("*", "\\w+") + "$";
      exchanges[exchange].bindings.push({ regex: new RegExp(re), queueName: queue, key: key });

      return resolve();
    });
  },

  unbindQueue: function (queue, exchange, key, args) {
    return new Bluebird(function (resolve, reject) {
      if (exchanges[exchange]) {
        var idx = exchanges[exchange].bindings.find(function (binding) {
          return binding.key === key;
        })
        if (idx > -1) {
          exchanges[exchange].bindings.splice(idx, 1)
        }
      }
      return resolve()
    })
  },

  publish: function (exchange, routingKey, content, props) {
    return new Bluebird(function (resolve, reject) {
      if (!exchanges[exchange])
        return reject("Publish to non-existing exchange " + exchange);

      var bindings = exchanges[exchange].bindings;
      var matchingBindings = bindings.filter(function (b) { return b.regex.test(routingKey); });

      matchingBindings.forEach(function (binding) {
        var subscribers = queues[binding.queueName] ? queues[binding.queueName].subscribers : [];
        subscribers.forEach(function (sub) {
          var message = { fields: { routingKey: routingKey }, properties: props, content: content };
          sub.handler(message);
        });
      });

      return resolve();
    })
  },

  consume: function (queue, handler) {
    var consumerTag = Math.random().toString(36)
    queues[queue].subscribers.push({ handler: handler, consumerTag: consumerTag });
    return Bluebird.resolve({ consumerTag: consumerTag })
  },

  cancel: function (consumerTag) {
    return new Bluebird(function (resolve) {
      for (q in queues) {
        let idx = queues[q].subscribers.find(function (sub) {
          return sub.consumerTag === consumerTag;
        })
        if (idx > -1 ) {
          queues[q].subscribers.splice(idx, 1)
        }
      }
      return resolve()
    })
  },

  deleteQueue: function (queue) {
    setImmediate(function () {
      delete queues[queue];
    });
  },

  ack: function () { },
  nack: function () { },
  prefetch: function () { },
  on: function () { },
  once: function () { },
  setMaxListeners: function () { },
  close: function () {
    return Bluebird.resolve();
  }
};
function createChannel() {
  return new Bluebird(function (resolve) {
    return resolve(channel);
  });
};
function connect(url, options) {
  return new Bluebird(function (resolve) {

    var connection = {
      createChannel: createChannel,
      createConfirmChannel: createChannel,
      on: function () { },
      once: function () { },
      close: function () {
        return Bluebird.resolve();
      }
    };

    return resolve(connection);
  });
}

function resetMock() {
  queues = {};
  exchanges = {};
}

module.exports = { connect: connect, resetMock: resetMock };

function setIfUndef(object, prop, value) {
  if (!object[prop]) {
    object[prop] = value;
  }
}
