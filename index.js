const events = require('events');

const MAX_BLOCK_SIZE = Math.pow(2, 32) - 1;

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
			if (event !== 'message') return;
			if (this.listenerCount('message')) return;
			this.stream.resume();
		}).on('removeListener', (event) => {
			if (event !== 'message') return;
			if (this.listenerCount('message')) return;
			this.stream.pause();
		});

		// Forward close events
		this.stream.on('close', () => this.emit('close'));
		this.stream.on('end', () => this.emit('end'));
		this.stream.on('error', (err) => this.emit('error', err));
	}

	send (buf) {
		// Make sure buf is always an array
		if (!(buf instanceof Array)) buf = [ buf ];

		// Prepare length field
		const length = buf.reduce((len, b) => len + b.length, 0);
		if (length > MAX_BLOCK_SIZE) return Promise.reject(new Error('Buffer too long'));
		const lengthField = Buffer.alloc(4);
		lengthField.writeUInt32BE(length, 0);

		// Send frame
		const jobs = [];
		const sendBlock = (b) => jobs.push(new Promise((resolve) => {
			if (b.length === 0) resolve();
			else this.stream.write(b, resolve);
		}));
		sendBlock(lengthField);
		buf.forEach((b) => sendBlock(b));
		return Promise.all(jobs);
	}

	close () {
		this.stream.destroy();
		if (this.stream.destroyed) return Promise.resolve();
		else return new Promise((resolve) => this.on('close', resolve));
	}
}

module.exports = Bloxy;
