const events = require('events');

const mockStreamFactory = () => {
	const e = new events.EventEmitter();
	e.write = jest.fn();
	e.pause = jest.fn();
	e.resume = jest.fn();
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
