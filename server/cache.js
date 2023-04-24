const cache = {};

function get(key) {
	return cache[key];
}

function set(key, value) {
	cache[key] = value;
}

export default { get, set };