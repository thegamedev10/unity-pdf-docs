#!/usr/bin/env node
'use strict'

const htmlToPdf = require('html-pdf-chrome')
const { launch } = require('chrome-launcher')
const rmrf = require('rimraf')
const mkdirp = require('mkdirp')
const { homedir } = require('os')

const path = require('path')
const fs = require('fs')
const { promisify } = require('util')
const readFile = promisify(fs.readFile)
const writeFile = promisify(fs.writeFile)
const unlink = promisify(fs.unlink)
const relativePages = require('./pages.json')
const relativeScripts = require('./scripts.json')

const targetPath = path.join(homedir(), 'unity-docs')
const manualPath = path.join(targetPath, 'manual')
const scriptPath = path.join(targetPath, 'script')

const docsRoot = process.argv[2]

function cleanOld() {
  try {
    rmrf.sync(targetPath)
  } catch (_) {}
  try {
    mkdirp.sync(manualPath)
    mkdirp.sync(scriptPath)
  } catch (err) {
    console.error(err)
  }
}
cleanOld()

const absoluteManuals = relativePages.map(x => path.join(docsRoot, x))
const absoluteScripts = relativeScripts.map(x => path.join(docsRoot, x))
const DEBUG_PORT = 9222

async function rewrite(file) {
  const html = await readFile(file, 'utf8')
  let bodyStart = -1
  let bodyEnd = -1
  let keepBodyStart = -1
  let dumpBodyStart = -1
  // Script Manuals are bunched together, so we prettify them before splitting
  // into lines
  const lines = html
    .split('><')
    .join('>\n<')
    .split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (bodyStart < 0 && /^<body>/.test(line)) bodyStart = i
    else if (bodyEnd < 0 && /^<\/body>/.test(line)) bodyEnd = i
    else if (keepBodyStart < 0 && /class="scrollToFeedback"/.test(line)) keepBodyStart = i
    else if (dumpBodyStart < 0 && /class="feedbackbox"/.test(line)) dumpBodyStart = i
  }

  // Print warnings for anomalies, still use the page in it's entirety
  let allGood = true
  if (bodyStart < 0) {
    console.error('  Unable to find body start')
    allGood = false
  }
  if (bodyEnd < 0) {
    console.error('  Unable to find body end')
    allGood = false
  }
  if (keepBodyStart < 0) {
    console.error('  Unable to find interesting body section')
    allGood = false
  }
  if (dumpBodyStart < 0) {
    console.error('  Unable to find uninteresting footer section')
    allGood = false
  }

  const fileName = file.replace(/\.html/, '.print-ready.html')
  let fixedHtml
  if (!allGood) {
    fixedHtml = html
  } else {
    const beforeBody = lines.slice(0, bodyStart)
    const afterKeepBody = lines.slice(keepBodyStart, dumpBodyStart)
    fixedHtml = beforeBody.concat(afterKeepBody).join('\n') + '</body></html>'
  }
  await writeFile(fileName, fixedHtml, 'utf8')
  return fileName
}

async function toPdf(file) {
  const fileName = await rewrite(file)
  try {
    const pdf = await htmlToPdf.create(`file://${fileName}`, { port: DEBUG_PORT })
    return pdf
  } catch (err) {
    throw err
  } finally {
    try { await unlink(fileName) } catch (_) {}
  }
}

function pdfPath(root, idx, file) {
  const fileName = `${(idx + 1 + '').padStart(4, '0')}.${path.basename(file).slice(0, -4)}pdf`
  return path.join(root, fileName)
}

async function writePdf(root, idx, file, pdf) {
  const p = pdfPath(root, idx, file)
  console.error('Writing converted', p)
  return pdf.toFile(p)
}

async function convertPages(pdfPath, absolutePaths) {
  for (let idx = 0; idx < absolutePaths.length; idx++) {
    let page
    try {
      page = absolutePaths[idx]
      console.error('Converting', page)
      const pdf = await toPdf(page)
      await writePdf(pdfPath, idx, page, pdf)
    } catch (err) {
      console.error(err)
      console.error('Failed to convert page', page)
    }
  }
}

;(async function run() {
  let chrome
  try {
    chrome = await launch({
        port: DEBUG_PORT
      , enableExtensions: false
      , chromeFlags: [
            '--interpreter none'
          , '--headless'
          , '--disable-gpu'
          , '--disable-translate'
          , '--disable-extensions'
          , '--disable-background-networking'
          , '--safebrowsing-disable-auto-update'
          , '--disable-sync'
          , '--metrics-recording-only'
          , '--disable-default-apps'
          , '--no-first-run'
          , '--mute-audio'
          , '--hide-scrollbars'
        ]
      , startingUrl: null
    })
  } catch (err) {
    console.error('Failed to launch chrome', err)
    return
  }

  console.error('Processing a total of %d manual pages, hang tight!', absoluteManuals.length)
  await convertPages(manualPath, absoluteManuals)

  console.error('Processing a total of %d script pages, hang tight!', absoluteScripts.length)
  await convertPages(scriptPath, absoluteScripts)

  chrome.kill()
})()
