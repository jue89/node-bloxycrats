const events = require('events');

const mockStreamFactory = () => {
	const e = new events.EventEmitter();
	e.write = jest.fn();
	e.pause = jest.fn();
	e.resume = jest.fn();
	e.destroy = jest.fn();
	return e;
};

const Bloxy = require('../index.js');

test('send buffer', () => {
	const stream = mockStreamFactory();
	const block = Buffer.alloc(64, 'a');
	const len = Buffer.alloc(4);
	len.writeUInt32BE(block.length, 0);
	const b = new Bloxy(stream);
	b.send(block);
	expect(stream.write.mock.calls[0][0].toString('hex')).toEqual(len.toString('hex'));
	expect(stream.write.mock.calls[1][0].toString('hex')).toEqual(block.toString('hex'));
});

test('send an array of buffer', () => {
	const stream = mockStreamFactory();
	const block = Buffer.alloc(64, 'a');
	const len = Buffer.alloc(4);
	len.writeUInt32BE(2 * block.length, 0);
	const b = new Bloxy(stream);
	b.send([block, block]);
	expect(stream.write.mock.calls[0][0].toString('hex')).toEqual(len.toString('hex'));
	expect(stream.write.mock.calls[1][0].toString('hex')).toEqual(block.toString('hex'));
	expect(stream.write.mock.calls[2][0].toString('hex')).toEqual(block.toString('hex'));
});

test('receive buffer', () => {
	const stream = mockStreamFactory();
	const block = Buffer.alloc(64, 'a');
	const data = Buffer.concat([Buffer.alloc(4), block]);
	data.writeUInt32BE(block.length, 0);
	const b = new Bloxy(stream);
	const onMessage = jest.fn();
	b.on('message', onMessage);
	stream.emit('data', data);
	expect(onMessage.mock.calls[0][0].toString('hex')).toEqual(block.toString('hex'));
});

test('receive splitted buffer', () => {
	const stream = mockStreamFactory();
	const block = Buffer.alloc(64, 'a');
	const data = Buffer.concat([Buffer.alloc(4), block]);
	data.writeUInt32BE(block.length, 0);
	const b = new Bloxy(stream);
	const onMessage = jest.fn();
	b.on('message', onMessage);
	stream.emit('data', data.slice(0, 8));
	stream.emit('data', data.slice(8));
	expect(onMessage.mock.calls[0][0].toString('hex')).toEqual(block.toString('hex'));
});

test('receive buffer byte by byte', () => {
	const stream = mockStreamFactory();
	const block = Buffer.alloc(64, 'a');
	const data = Buffer.concat([ Buffer.alloc(4), block ]);
	data.writeUInt32BE(block.length, 0);
	const b = new Bloxy(stream);
	const onMessage = jest.fn();
	b.on('message', onMessage);
	for (let i = 0; i < data.length; i++) {
		stream.emit('data', data.slice(i, i + 1));
	}
	expect(onMessage.mock.calls[0][0].toString('hex')).toEqual(block.toString('hex'));
});

test('receive two buffers in one chunk', () => {
	const stream = mockStreamFactory();
	const block = Buffer.alloc(64, 'a');
	const data = Buffer.concat([ Buffer.alloc(4), block ]);
	data.writeUInt32BE(block.length, 0);
	const b = new Bloxy(stream);
	const onMessage = jest.fn();
	b.on('message', onMessage);
	stream.emit('data', Buffer.concat([data, data]));
	expect(onMessage.mock.calls[0][0].toString('hex')).toEqual(block.toString('hex'));
	expect(onMessage.mock.calls[1][0].toString('hex')).toEqual(block.toString('hex'));
});

test('forward close event', () => {
	const stream = mockStreamFactory();
	const b = new Bloxy(stream);
	const onClose = jest.fn();
	b.on('close', onClose);
	stream.emit('close');
	expect(onClose.mock.calls.length).toBe(1);
});

test('forward end event', () => {
	const stream = mockStreamFactory();
	const b = new Bloxy(stream);
	const onEnd = jest.fn();
	b.on('end', onEnd);
	stream.emit('end');
	expect(onEnd.mock.calls.length).toBe(1);
});

test('forward error event', () => {
	const stream = mockStreamFactory();
	const b = new Bloxy(stream);
	const onError = jest.fn();
	b.on('error', onError);
	const err = new Error();
	stream.emit('error', err);
	expect(onError.mock.calls.length).toBe(1);
	expect(onError.mock.calls[0][0]).toBe(err);
});

test('propagate back-preassure', () => {
	const stream = mockStreamFactory();
	const b = new Bloxy(stream);
	expect(stream.pause.mock.calls.length).toBe(1);
	expect(stream.resume.mock.calls.length).toBe(0);
	const listener = () => {};
	b.on('message', listener);
	expect(stream.pause.mock.calls.length).toBe(1);
	expect(stream.resume.mock.calls.length).toBe(1);
	b.removeListener('message', listener);
	expect(stream.pause.mock.calls.length).toBe(2);
	expect(stream.resume.mock.calls.length).toBe(1);
});

test('propagate back-preassure on multiple listeners', () => {
	const stream = mockStreamFactory();
	const b = new Bloxy(stream);
	expect(stream.pause.mock.calls.length).toBe(1);
	expect(stream.resume.mock.calls.length).toBe(0);
	const listener1 = () => {};
	b.on('message', listener1);
	expect(stream.pause.mock.calls.length).toBe(1);
	expect(stream.resume.mock.calls.length).toBe(1);
	const listener2 = () => {};
	b.on('message', listener2);
	expect(stream.pause.mock.calls.length).toBe(1);
	expect(stream.resume.mock.calls.length).toBe(1);
	b.removeListener('message', listener1);
	expect(stream.pause.mock.calls.length).toBe(1);
	expect(stream.resume.mock.calls.length).toBe(1);
	b.removeListener('message', listener2);
	expect(stream.pause.mock.calls.length).toBe(2);
	expect(stream.resume.mock.calls.length).toBe(1);
});

test('complain about to long buffers', () => {
	const stream = mockStreamFactory();
	const b = new Bloxy(stream);
	const msg = { length: Math.pow(2, 32) };
	return b.send(msg)
		.then(() => Promise.reject(new Error('FAILED')))
		.catch((e) => { expect(e.message).toEqual('Buffer too long'); });
});

test('ignore empty buffers', () => {
	const stream = mockStreamFactory();
	const block = Buffer.alloc(0);
	const len = Buffer.alloc(4);
	len.writeUInt32BE(block.length, 0);
	const b = new Bloxy(stream);
	b.send(block);
	expect(stream.write.mock.calls[0][0].toString('hex')).toEqual(len.toString('hex'));
	expect(stream.write.mock.calls.length).toBe(1);
});

test('resolve promise if all chunks have been flushed', () => {
	const stream = mockStreamFactory();
	const block1 = Buffer.alloc(0);
	const block2 = Buffer.alloc(1);
	const b = new Bloxy(stream);
	stream.write.mockImplementation((data, cb) => cb());
	return b.send([block1, block2]);
});

test('destroy stream on close', () => {
	const stream = mockStreamFactory();
	const b = new Bloxy(stream);
	const q = b.close();
	expect(stream.destroy.mock.calls.length).toBe(1);
	b.emit('close');
	return q;
});

test('return to close calls if the socket already has been destroyed', () => {
	const stream = mockStreamFactory();
	const b = new Bloxy(stream);
	stream.destroyed = true;
	const q = b.close();
	expect(stream.destroy.mock.calls.length).toBe(1);
	return q;
});
