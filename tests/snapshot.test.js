// mock this module because it disallows screen-shooting localhost
jest.mock("../lib/blacklist.js", () => ({
  loadConfig() {},
  allowHost(_, callback) {
    callback(0);
  },
}));

const snapshot = require("../lib/snapshot.js");
const tmp = require("tmp");
const fs = require("fs");
const express = require("express");
const app = express();
const path = require("path");
const sharp = require("sharp");

app.use(express.static(path.resolve(__dirname, "./mock-content")));

/**
 * The puppeteer's Chrome instance
 */
let browser;

/**
 * The screenshot temp file path
 */
let tempFile;

/**
 * The static files server to host mocked websites
 */
let staticServer;

/**
 * A delay helper function
 * @param {Number} delay
 */
function sleep(delay) {
  return new Promise((r) => setTimeout(r, delay));
}

beforeAll(async () => {
  staticServer = app.listen(3000);
  browser = await snapshot.init_browser();
});

afterAll(async () => {
  staticServer.close();
  browser.close();
  // wait for the browser to exit
  await sleep(2000);
});

// create a tmp file before each test
beforeEach(() => (tempFile = tmp.fileSync().name));

// delete tmp file after every test
afterEach(() => fs.unlinkSync(tempFile));

test("add_to_queue: should create a snapshot", async () => {
  let site = {
    url: "http://127.0.0.1:3000/normal-site.html",
    file: tempFile,
    width: 1280,
    height: 720,
  };

  snapshot.add_to_queue(site);

  // snapshot polls the queue every 1000ms and screenshots take some time
  await sleep(4000);

  expect(fs.existsSync(tempFile));
  expect(fs.statSync(tempFile).size).toBeGreaterThan(0);
});

test("add_to_queue: should respect width and height params for normal height sites", async () => {
  let site = {
    url: "http://127.0.0.1:3000/normal-site.html",
    file: tempFile,
    width: 1280,
    height: 720,
  };

  snapshot.add_to_queue(site);

  // snapshot polls the queue every 1000ms and screenshots take some time
  await sleep(4000);

  const image = sharp(tempFile);
  const metadata = await image.metadata();

  expect(metadata.width).toEqual(1280);
  expect(metadata.height).toEqual(720);
});

test("add_to_queue: should respect width and height params for long sites", async () => {
  let site = {
    url: "http://127.0.0.1:3000/long-site.html",
    file: tempFile,
    width: 1280,
    height: 720,
  };

  snapshot.add_to_queue(site);

  // snapshot polls the queue every 1000ms and screenshots take some time
  await sleep(4000);

  const image = sharp(tempFile);
  const metadata = await image.metadata();

  expect(metadata.width).toEqual(1280);
  expect(metadata.height).toEqual(720);
});

test("add_to_queue: image dimensions should be equal to screenHeight and screenWidth for long enough sites", async () => {
  let site = {
    url: "http://127.0.0.1:3000/long-site.html",
    file: tempFile,
    width: 1280,
    height: 720,
    screenWidth: 1280,
    screenHeight: 2048,
  };

  snapshot.add_to_queue(site);

  // snapshot polls the queue every 1000ms and screenshots take some time
  await sleep(4500);

  const image = sharp(tempFile);
  const metadata = await image.metadata();

  expect(metadata.width).toEqual(site.screenWidth);
  expect(metadata.height).toEqual(site.screenHeight);
});
