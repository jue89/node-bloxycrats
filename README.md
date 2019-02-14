# Bloxycrats

This module transforms a duplex stream (e.g. TCP or TLS stream) into a block-oriented interface, like the `dgram` interface.

## Example

Server:

```js
const net = require('net');
const Bloxy = require('bloxycrats');
net.createServer((socket) => {
	const connection = new Bloxy(socket);
	connection.send(Buffer.from('Hello world!'));
}).listen(1337);
```

Client:

```js
const net = require('net');
const Bloxy = require('bloxycrats');
const connection = new Bloxy(net.connect({port: 1337}));
connection.on('message', (msg) => console.log(msg.toString()));
```

This may seem trivial. But Bloxycrats ensures that *"Hello World"* is always transferred in one block. It never happens that it gets split up into *"Hello W"* and *"orld"*.


## API

```js
const Bloxy = require('bloxycrats');
const connection = new Bloxy(stream);
```

Convert the duplex stream `stream` into the block-oriented interface `connection`.

### Method: send

```js
connection.send(buffer).then(() => {...});
```

Sends `buffer` to the other side. The returned **Promise** resolves once all data is flushed.

`buffer` is an instance of **Buffer** or an **Array** of **Buffer** that is concatenated before it goes on the wire.

### Event: message

```js
connection.on('message', (buffer) => {...});
```

This event is raised, once a complete buffer has been received.


### Event: close

```js
connection.on('close', (buffer) => {...});
```

This event is raised, once the underlaying stream has been closed.
