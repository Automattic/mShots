const dns = require("dns");
const blacklist = require("../lib/blacklist.js");

const SUCCESS = 0;
const HOST_NO_DNS = 1;
const HOST_BLACKLISTED = 2;
const HOST_IP_BLACKLISTED = 3;

function noData(_, callback) {
	const err = new Error("no data");
	err.code = dns.NODATA;
	callback(err);
}

function answers(addresses) {
	return (_, callback) => callback(null, addresses);
}

function mockDns(v4, v6) {
	jest.spyOn(dns, "resolve4").mockImplementation(v4 ? answers(v4) : noData);
	jest.spyOn(dns, "resolve6").mockImplementation(v6 ? answers(v6) : noData);
}

function allowHost(url) {
	return new Promise((resolve) => blacklist.allowHost(url, resolve));
}

beforeAll(() => new Promise((resolve) => blacklist.loadConfig(resolve)));

afterEach(() => jest.restoreAllMocks());

describe("allowAddress", () => {
test.each([
	"0.0.0.0",
	"0.1.2.3",
	"10.0.0.1",
	"100.64.0.1",
	"127.0.0.1",
	"127.255.255.254",
	"169.254.169.254",
	"172.16.0.1",
	"192.168.1.1",
	"198.18.0.1",
	"224.0.0.1",
	"255.255.255.255",
	"::",
	"::1",
	"[::1]",
	"::ffff:127.0.0.1",
	"::ffff:7f00:1",
	"::ffff:a9fe:a9fe",
	"64:ff9b::7f00:1",
	"fc00::1",
	"fd12:3456::1",
	"fe80::1",
	"ff02::1",
	"not-an-ip",
	"",
])("rejects %s", (address) => {
	expect(blacklist.allowAddress(address)).toEqual(HOST_IP_BLACKLISTED);
});

test.each(["8.8.8.8", "192.0.78.9", "2001:4860:4860::8888", "::ffff:8.8.8.8"])(
	"allows %s",
	(address) => {
	expect(blacklist.allowAddress(address)).toEqual(SUCCESS);
	}
);
});

describe("allowHost", () => {
test("rejects literal loopback addresses in any notation", async () => {
	for (const url of [
	"http://127.0.0.1:7777/",
	"http://127.1:7777/",
	"http://0x7f.1:7777/",
	"http://2130706433:7777/",
	"http://0.0.0.0:7777/",
	"http://[::1]:7777/",
	"http://[::ffff:127.0.0.1]:7777/",
	]) {
	expect([url, await allowHost(url)]).toEqual([url, HOST_IP_BLACKLISTED]);
	}
});

test("rejects localhost names without a DNS lookup", async () => {
	mockDns(["8.8.8.8"]);
	expect(await allowHost("http://localhost:7777/")).toEqual(HOST_BLACKLISTED);
	expect(await allowHost("http://foo.localhost:7777/")).toEqual(HOST_BLACKLISTED);
});

test("allows a host with only public addresses", async () => {
	mockDns(["8.8.8.8"], ["2001:4860:4860::8888"]);
	expect(await allowHost("http://example.com/")).toEqual(SUCCESS);
});

test("rejects a host whose AAAA record is loopback", async () => {
	mockDns(["8.8.8.8"], ["::1"]);
	expect(await allowHost("http://example.com/")).toEqual(HOST_IP_BLACKLISTED);
});

test("rejects a host with only a private AAAA record", async () => {
	mockDns(null, ["fd00::1"]);
	expect(await allowHost("http://example.com/")).toEqual(HOST_IP_BLACKLISTED);
});

test("rejects a host that resolves to 0.0.0.0", async () => {
	mockDns(["0.0.0.0"]);
	expect(await allowHost("http://example.com/")).toEqual(HOST_IP_BLACKLISTED);
});

test("reports a host with no A or AAAA records", async () => {
	mockDns(null, null);
	expect(await allowHost("http://example.com/")).toEqual(HOST_NO_DNS);
});

test("still applies the configured hostname blacklist", async () => {
	mockDns(["8.8.8.8"]);
	expect(await allowHost("http://pixel.wp.com/")).toEqual(HOST_BLACKLISTED);
});
});
