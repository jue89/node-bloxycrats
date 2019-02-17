const events = require('events');

class Bloxy extends events.EventEmitter {
	constructor (stream) {
		super();
		this.stream = stream;

		// Setup stream processor
		let chunks = [];
		let chunksLength = 0;
		let length = -1;
		const squashChunks = () => { chunks = [ Buffer.concat(chunks) ]; };
		this.stream.on('data', (chunk) => {
			chunks.push(chunk);
			chunksLength += chunk.length;
			while (true) {
				if (length === -1 && chunksLength >= 4) {
					// No length has been read, yet -> try to read it
					squashChunks();
					length = chunks[0].readUInt32BE(0);
				} else if (length !== -1 && chunksLength >= length + 4) {
					// We received enough bytes for the current block
					squashChunks();
					this.emit('message', chunks[0].slice(4, length + 4));
					chunksLength -= length + 4;
					if (chunksLength > 0) {
						chunks[0] = chunks[0].slice(length + 4);
					} else {
						chunks = [];
					}
					length = -1;
				} else {
					break;
				}
			}
		});

		// Control back-preassure
		this.stream.pause();
		this.on('newListener', (event) => {
			if (event === 'message') this.stream.resume();
		}).on('removeListener', (event) => {
			if (event === 'message') this.stream.pause();
		});

		// Forward close events
		this.stream.on('close', () => this.emit('close'));
	}

	send (buf) {
		if (!(buf instanceof Array)) buf = [ buf ];
		const lengthField = Buffer.alloc(4);
		lengthField.writeUInt32BE(buf.reduce((len, b) => len + b.length, 0), 0);
		this.stream.write(lengthField);
		return Promise.all(buf.map((b) => new Promise((resolve) => {
			this.stream.write(b, resolve);
		})));
	}
}

module.exports = Bloxy;
