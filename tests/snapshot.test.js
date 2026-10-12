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

// The Sec-CH-Prefers-Color-Scheme hint the color scheme page was last requested with
let colorSchemeHint;
app.use((req, res, next) => {
  if (req.path === "/color-scheme-site.html") {
    colorSchemeHint = req.headers["sec-ch-prefers-color-scheme"];
  }
  next();
});
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

beforeAll(async () => {
  staticServer = app.listen(3000);
  browser = await snapshot.init_browser();
});

afterAll(async () => {
  staticServer.close();
  await browser.close();
});

let mockSend;

beforeEach(() => {
  // create a tmp file before each test
  tempFile = tmp.fileSync().name;
  // non-invasively receive snapshot queue notifications
  mockSend = jest.spyOn(process, 'send');
});

afterEach(
  () => {
    // delete tmp file after every test
    fs.unlinkSync(tempFile)
    // restore real process.send
    mockSend.mockRestore();
})

// Helper function: Queue a snapshot and wait for it to complete
async function getSnapshotResult( site ) {
  return new Promise( ( resolve ) => {
    mockSend.mockImplementationOnce( resolve )
    snapshot.add_to_queue(site);
  });
}

test("add_to_queue: should create a snapshot", async () => {
  let site = {
    url: "http://127.0.0.1:3000/normal-site.html",
    file: tempFile,
    width: 1280,
    height: 720,
  };

  const result = await getSnapshotResult( site );
  expect( result.payload.status ).toEqual( 0 );
  expect(fs.existsSync(tempFile));
  expect(fs.statSync(tempFile).size).toBeGreaterThan(0);
});

// Reads the colour of the screenshot's top-left pixel
async function topLeftPixel( file ) {
  const { data } = await sharp( file ).extract( { left: 0, top: 0, width: 1, height: 1 } ).raw().toBuffer( { resolveWithObject: true } );
  return [ data[0], data[1], data[2] ];
}

test("add_to_queue: should render the page's light styles by default and its dark styles for colorScheme dark", async () => {
  const site = {
    url: "http://127.0.0.1:3000/color-scheme-site.html",
    file: tempFile,
    width: 1280,
    height: 720,
    format: "png",
  };

  await getSnapshotResult( site );
  expect( await topLeftPixel( tempFile ) ).toEqual( [ 255, 255, 255 ] );
  expect( colorSchemeHint ).toBeUndefined();

  // a separate file, since sharp caches what it read from the first one
  const darkFile = tmp.fileSync().name;
  try {
    await getSnapshotResult( { ...site, file: darkFile, colorScheme: "dark" } );
    expect( await topLeftPixel( darkFile ) ).toEqual( [ 17, 17, 17 ] );
    expect( colorSchemeHint ).toEqual( '"dark"' );
  } finally {
    fs.unlinkSync( darkFile );
  }
  // two snapshots, so allow the same time as the long-site test
}, 15000);

test("add_to_queue: should respect width and height params for normal height sites", async () => {
  let site = {
    url: "http://127.0.0.1:3000/normal-site.html",
    file: tempFile,
    width: 1280,
    height: 720,
  };

  await getSnapshotResult( site );
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

  await getSnapshotResult( site );

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

  await getSnapshotResult( site );

  const image = sharp(tempFile);
  const metadata = await image.metadata();

  expect(metadata.width).toEqual(site.screenWidth);
  expect(metadata.height).toEqual(site.screenHeight);
  // use 15000ms timeout because longer screenshots need more time
}, 15000);
